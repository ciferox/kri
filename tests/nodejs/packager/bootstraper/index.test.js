import protoBootstraper from "./proto";
import { getSimpleBuilder, volumePath } from "./helpers";

const {
    fs,
    std: { path: { join } }
} = adone;

const {
    nodejs: { EOFBuilder }
} = kri;

const writeExecFile = (execPath, eofBuilder) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(execPath);
    eofBuilder.toStream()
        .pipe(ws)
        .on("close", resolve)
        .on("error", reject);
});

describe("nodejs", "packager", "bootstraper", () => {
    let tmpPath;
    let eofBuilder;

    beforeEach(async () => {
        eofBuilder = new EOFBuilder();
        tmpPath = await fs.tmpName();
        await fs.mkdir(tmpPath);
    });

    afterEach(async () => {
        await fs.rm(tmpPath);
    });

    it("should throw with bad exec file", async () => {
        const execPath = join(tmpPath, "exec");
        await fs.writeFile(execPath, Buffer.allocUnsafe(1024));
        await assert.throws(async () => protoBootstraper(execPath), Error, /Invalid signature/);
    });

    it("should throw is version is not supported", async () => {
        eofBuilder.build(false);
        // modify version
        eofBuilder.header.writeUInt16BE(EOFBuilder.VERSION + 1, 12);
        const execPath = join(tmpPath, "exec");
        await fs.writeFile(execPath, eofBuilder.header);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Unsupported version/);
    });

    it("should throw if number of volumes is not correct", async () => {
        eofBuilder.build(false);
        const execPath = join(tmpPath, "exec");

        await fs.writeFile(execPath, eofBuilder.header);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Number of volumes out of range/);

        // modify number of volumes
        eofBuilder.header.writeUInt16BE(65, 14);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Number of volumes out of range/);
    });

    it("should throw if section header size is incorrect", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // modify in common header
        eofBuilder.header.writeUInt32BE(eofBuilder.header.readUInt32BE(16) - 1, 16);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Invalid volume header size/);
        eofBuilder.header.writeUInt32BE(eofBuilder.header.readUInt32BE(16) + 1, 16);

        // modify in section header
        eofBuilder.volumes[0].header.writeUInt32BE(eofBuilder.volumes[0].header.readUInt32BE(0) + 1, 0);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Invalid volume header size/);
    });

    it("should throw if section data size is incorrect", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // modify in common header
        eofBuilder.header.writeUInt32BE(eofBuilder.header.readUInt32BE(20) - 1, 20);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Invalid volume header size/);
        eofBuilder.header.writeUInt32BE(eofBuilder.header.readUInt32BE(20) + 1, 20);

        // // modify in section header
        eofBuilder.volumes[0].header.writeUInt32BE(eofBuilder.volumes[0].header.readUInt32BE(4) + 1, 4);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Invalid section data size/);
    });

    it("should throw is name is not prefixed with '/'", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // modify mount name
        eofBuilder.volumes[0].header.write("dapp", 24, 4);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /nvalid volume mount name/);
    });
});
