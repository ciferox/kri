const {
    error,
    fs,
    std: { path }
} = adone;
const {
    nodejs: { EOFBuilder }
} = kri;

const readString = (buff, ctx) => {
    const { offset } = ctx;
    const sz = buff.readUInt16BE(offset);
    ctx.offset += 2;
    if (sz > 0) {
        ctx.offset += sz;
        return buff.slice(offset + 2, offset + 2 + sz).toString("utf8");
    }
    return "";
};

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

    it("should throw when add volume without type", async () => {
        await assert.throws(async () => eofBuilder.addVolume(), error.NotValidException, /Invalid volume type/);
        await assert.throws(async () => eofBuilder.addVolume({ name: "" }), error.NotValidException, /Invalid volume type/);
        await assert.throws(async () => eofBuilder.addVolume({ name: undefined }), error.NotValidException, /Invalid volume type/);
        await assert.throws(async () => eofBuilder.addVolume({ name: null }), error.NotValidException, /Invalid volume type/);
        await assert.throws(async () => eofBuilder.addVolume({ name: new Array(3) }), error.NotValidException, /Invalid volume type/);
    });

    it("should throw when add volume without name", async () => {
        await assert.throws(async () => eofBuilder.addVolume({ type: "zip" }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ type: "zip", name: "" }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ type: "zip", name: undefined }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ type: "zip", name: null }), error.NotValidException, /Invalid volume name/);
        await assert.throws(async () => eofBuilder.addVolume({ type: "zip", name: new Array(3) }), error.NotValidException, /Invalid volume name/);
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
            await assert.throws(async () => eofBuilder.addVolume({ type: "zip", name: "app", volume: await volume() }), error.NotValidException, /Invalid volume source data/);
        }

        await fs.rm(tmpPath);
    });

    it("name should be prefixed with '/'", async () => {
        await eofBuilder.addVolume({ type: "zip", name: "app", volume: Buffer.alloc(256) });
        assert.equal(eofBuilder.volumes[0].name, "/app");
        assert.equal(eofBuilder.volumes[0].startup, false);
    });

    it("prefixed name should be ok", async () => {
        await eofBuilder.addVolume({ type: "zip", name: "/app", volume: Buffer.alloc(256) });
        assert.equal(eofBuilder.volumes[0].name, "/app");
        assert.equal(eofBuilder.volumes[0].startup, false);
    });

    it("should accept index", async () => {
        await eofBuilder.addVolume({ type: "zip", name: "app", volume: Buffer.alloc(256), index: "index.js" });
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
            type: "zip",
            name: "1",
            volume: volPath
        });

        assert.deepEqual(eofBuilder.volumes[0].data, buf);
        assert.equal(eofBuilder.volumes[0].startup, false);
        fs.rm(tmpPath);
    });

    it("add startup volume", async () => {
        await eofBuilder.addVolume({
            type: "zip",
            name: "app",
            volume: Buffer.alloc(512),
            startup: true
        });

        assert.equal(eofBuilder.volumes[0].startup, true);
    });

    it("should thow is try to add startup volume second time", async () => {
        await eofBuilder.addVolume({
            type: "zip",
            name: "app",
            volume: Buffer.alloc(512),
            startup: true
        });

        await assert.throws(async () => eofBuilder.addVolume({
            type: "zip",
            name: "app2",
            volume: Buffer.alloc(512),
            startup: true
        }));
    });

    const checkHeader = (builder, numberOfVolumes, initSectionSize, firstSectionSize, firstSectionHdrSize) => {
        assert.lengthOf(builder.header, EOFBuilder.HEADER_SIZE);
        assert.equal(builder.header.slice(0, EOFBuilder.SIG.length).toString("utf8"), EOFBuilder.SIG);
        assert.equal(builder.header.readUInt16BE(12), EOFBuilder.VERSION);
        assert.equal(builder.header.readUInt16BE(14), numberOfVolumes); // number of volumes
        assert.equal(builder.header.readUInt32BE(16), firstSectionHdrSize); // first section header size
        // assert.equal(builder.header.readUInt32BE(20), firstSectionSize); // first section size
        // assert.equal(builder.header.readUInt32BE(24), initSectionSize); // 'init' section size
    };

    const checkVolumeHeader = (vol, expectedSectionHdrSize, data, type, name, mapping, index, nextSectionSize, netSectionHdrSize) => {
        assert.lengthOf(vol.header, expectedSectionHdrSize);
        assert.equal(vol.header.readUInt32BE(0), expectedSectionHdrSize); // header size
        assert.equal(vol.header.readUInt32BE(4), data.length); // data size
        assert.equal(vol.header.readUInt32BE(16), netSectionHdrSize); // next section header size
        assert.equal(vol.header.readUInt32BE(20), nextSectionSize); // next section size
        const ctx = { offset: 24 };
        assert.equal(readString(vol.header, ctx), name);
        assert.equal(readString(vol.header, ctx), type);
        assert.equal(readString(vol.header, ctx), mapping);
        assert.equal(readString(vol.header, ctx), index);
    };

    it("build without volumes", () => {
        eofBuilder.build(false);

        assert.isTrue(eofBuilder.builded);
        checkHeader(eofBuilder, 0, 0, 0, 0);
    });

    it("build with one volume", async () => {
        const type = "zip";
        const name = "/app";
        const index = "index.js";
        const mapping = "mapping";
        const volume = Buffer.allocUnsafe(512);
        await eofBuilder.addVolume({
            type: "zip",
            name,
            mapping,
            volume,
            startup: true,
            index
        });

        eofBuilder.build();

        const expectedSectionHdrSize = 4 + 4 + 4 + 4 + 4 + 4 + 4 * 2 + type.length + name.length + index.length + mapping.length;
        const expectedSectionSize = expectedSectionHdrSize + volume.length;

        checkHeader(eofBuilder, 1, 0, expectedSectionSize, expectedSectionHdrSize);
        checkVolumeHeader(eofBuilder.volumes[0], expectedSectionHdrSize, volume, type, name, mapping, index, 0, 0);
    });

    it("build with two volumes", async () => {
        const volumes = [
            {
                type: "zip",
                name: "/framework",
                mapping: "framew",
                index: "lib_name.js",
                volume: Buffer.allocUnsafe(1024)
            },
            {
                type: "fs",
                name: "/app",
                mapping: "map",
                index: "index.js",
                volume: Buffer.allocUnsafe(2028),
                startup: true
            }
        ];

        for (const info of volumes) {
            await eofBuilder.addVolume(info);
        }

        eofBuilder.build();

        const expectedSectionHdrSize0 = 4 + 4 + 4 + 4 + 4 + 4 + 4 * 2 + volumes[0].name.length + volumes[0].index.length + volumes[0].type.length + volumes[0].mapping.length;
        const expectedSectionSize0 = expectedSectionHdrSize0 + volumes[0].volume.length;

        const expectedSectionHdrSize1 = 4 + 4 + 4 + 4 + 4 + 4 + 4 * 2 + volumes[1].name.length + volumes[1].index.length + volumes[1].type.length + volumes[1].mapping.length;
        const expectedSectionSize1 = expectedSectionHdrSize1 + volumes[1].volume.length;

        checkHeader(eofBuilder, 2, 0, expectedSectionSize1, expectedSectionHdrSize1);
        checkVolumeHeader(eofBuilder.volumes[0], expectedSectionHdrSize0, volumes[0].volume, volumes[0].type, volumes[0].name, volumes[0].mapping, volumes[0].index, 0, 0);
        checkVolumeHeader(eofBuilder.volumes[1], expectedSectionHdrSize1, volumes[1].volume, volumes[1].type, volumes[1].name, volumes[1].mapping, volumes[1].index, expectedSectionSize0, expectedSectionHdrSize0);
    });
});
