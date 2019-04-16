const {
    error,
    fs,
    std: { path }
} = adone;
const {
    nodejs: { EOFBuilder }
} = kri;

describe("nodejs", "packager", "eof data format", () => {
    let eofBuilder;

    beforeEach(() => {
        eofBuilder = new EOFBuilder();
    });

    it("construct", () => {
        assert.lengthOf(eofBuilder.volumes, 0);
        assert.isFalse(eofBuilder.builded);
    });

    it("should throw if try to build without volumes", () => {
        assert.throws(() => eofBuilder.build(), error.NotAllowedException);
    });

    it("should throw when add volume without name", async () => {
        await assert.throws(async () => eofBuilder.addVolume(), error.NotValidException);
    });

    it("should throw when add volume without name", async () => {
        await assert.throws(async () => eofBuilder.addVolume(), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ name: "" }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ name: undefined }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ name: null }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ name: new Array(3) }), error.NotValidException, /Invalid volume name/);
    });

    it("should throw when add volume without source", async () => {
        const tmpPath = await fs.tmpName();
        await fs.mkdirp(tmpPath);

        const badVolumes = [
            () => undefined,
            () => null,
            () => Buffer.alloc(127),
            () => new Array(256),
            async () => {
                const volPath = path.join(tmpPath, "vol");
                const buf = Buffer.allocUnsafe(127);
                await fs.writeFile(volPath, buf);
                return volPath;
            }
        ];

        for (const volume of badVolumes) {
            await assert.throws(async () => eofBuilder.addVolume({ name: "app", volume: await volume() }), error.NotValidException, /Invalid volume source data/);
        }

        await fs.rm(tmpPath);
    });

    it("name should be prefixed with '/'", async () => {
        await eofBuilder.addVolume({ name: "app", volume: Buffer.alloc(256) });
        assert.equal(eofBuilder.volumes[0].name, "/app");
        assert.equal(eofBuilder.volumes[0].startup, false);
    });

    it("prefixed name should be ok", async () => {
        await eofBuilder.addVolume({ name: "/app", volume: Buffer.alloc(256) });
        assert.equal(eofBuilder.volumes[0].name, "/app");
        assert.equal(eofBuilder.volumes[0].startup, false);
    });

    it("should accept index", async () => {
        await eofBuilder.addVolume({ name: "app", volume: Buffer.alloc(256), index: "index.js" });
        assert.equal(eofBuilder.volumes[0].index, "index.js");
        assert.equal(eofBuilder.volumes[0].startup, false);
    });

    it("add volume sourced by file", async () => {
        const tmpPath = await fs.tmpName();
        await fs.mkdirp(tmpPath);
        const volPath = path.join(tmpPath, "vol");
        const buf = Buffer.allocUnsafe(512);
        await fs.writeFile(volPath, buf);
        await eofBuilder.addVolume({
            name: "1",
            volume: volPath
        });

        assert.deepEqual(eofBuilder.volumes[0].data, buf);
        assert.equal(eofBuilder.volumes[0].startup, false);
        fs.rm(tmpPath);
    });

    it("add startup volume", async () => {
        await eofBuilder.addVolume({
            name: "app",
            volume: Buffer.alloc(512),
            startup: true
        });

        assert.equal(eofBuilder.volumes[0].startup, true);
    });

    it("should thow is try to add startup volume second time", async () => {
        await eofBuilder.addVolume({
            name: "app",
            volume: Buffer.alloc(512),
            startup: true
        });

        await assert.throws(async () => eofBuilder.addVolume({
            name: "app2",
            volume: Buffer.alloc(512),
            startup: true
        }));
    });

    const checkHeader = (builder, numberOfVolumes, firstSectionSize, firstSectionHdrSize) => {
        assert.lengthOf(builder.header, EOFBuilder.HEADER_SIZE);
        assert.equal(builder.header.slice(0, EOFBuilder.SIG.length).toString("utf8"), EOFBuilder.SIG);
        assert.equal(builder.header.readUInt16BE(12), EOFBuilder.VERSION);
        assert.equal(builder.header.readUInt16BE(14), numberOfVolumes); // number of volumes
        assert.equal(builder.header.readUInt32BE(16), firstSectionSize); // first section size
        assert.equal(builder.header.readUInt32BE(20), firstSectionHdrSize); // first section header size
    };

    const checkVolumeHeader = (vol, expectedSectionHdrSize, data, name, index, nextSectionSize, netSectionHdrSize) => {
        assert.lengthOf(vol.header, expectedSectionHdrSize);
        assert.equal(vol.header.readUInt32BE(0), expectedSectionHdrSize); // header size
        assert.equal(vol.header.readUInt32BE(4), data.length); // data size
        assert.equal(vol.header.readUInt32BE(8), name.length); // name size
        assert.equal(vol.header.readUInt32BE(12), index.length); // index size
        assert.equal(vol.header.readUInt32BE(16), nextSectionSize); // next section size
        assert.equal(vol.header.readUInt32BE(20), netSectionHdrSize); // next section header size
        assert.equal(vol.header.slice(24, 24 + name.length).toString("utf8"), name);
        assert.equal(vol.header.slice(24 + name.length, 24 + name.length + index.length).toString("utf8"), index);
    };

    it("build without volumes", () => {
        eofBuilder.build(false);

        assert.isTrue(eofBuilder.builded);
        checkHeader(eofBuilder, 0, 0, 0);
    });

    it("build with one volume", async () => {
        const name = "/app";
        const index = "index.js";
        const volume = Buffer.allocUnsafe(512); 
        await eofBuilder.addVolume({
            name,
            volume,
            startup: true,
            index
        });

        eofBuilder.build();

        const expectedSectionHdrSize = 4 + 4 + 4 + 4 + 4 + 4 + name.length + index.length;
        const expectedSectionSize = expectedSectionHdrSize + volume.length;

        checkHeader(eofBuilder, 1, expectedSectionSize, expectedSectionHdrSize);
        checkVolumeHeader(eofBuilder.volumes[0], expectedSectionHdrSize, volume, name, index, 0, 0);
    });


    it("build with two volumes", async () => {
        const volumes = [
            {
                name: "/framework",
                index: "lib_name.js",
                volume: Buffer.allocUnsafe(1024)
            },
            {
                name: "/app",
                index: "index.js",
                volume: Buffer.allocUnsafe(2028),
                startup: true
            }
        ];

        for (const info of volumes) {
            await eofBuilder.addVolume(info);
        }

        eofBuilder.build();

        const expectedSectionHdrSize0 = 4 + 4 + 4 + 4 + 4 + 4 + volumes[0].name.length + volumes[0].index.length;
        const expectedSectionSize0 = expectedSectionHdrSize0 + volumes[0].volume.length;

        const expectedSectionHdrSize1 = 4 + 4 + 4 + 4 + 4 + 4 + volumes[1].name.length + volumes[1].index.length;
        const expectedSectionSize1 = expectedSectionHdrSize1 + volumes[1].volume.length;

        checkHeader(eofBuilder, 2, expectedSectionSize1, expectedSectionHdrSize1);
        checkVolumeHeader(eofBuilder.volumes[0], expectedSectionHdrSize0, volumes[0].volume, volumes[0].name, volumes[0].index, 0, 0);
        checkVolumeHeader(eofBuilder.volumes[1], expectedSectionHdrSize1, volumes[1].volume, volumes[1].name, volumes[1].index, expectedSectionSize0, expectedSectionHdrSize0);
    });
});
