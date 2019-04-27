import protoBootstraper from "./proto";
import { getSimpleBuilder, writeExecFile } from "./helpers";

const {
    fs,
    std: { path: { join } }
} = adone;

const {
    packager: { EOFBuilder }
} = kri;

describe("packager", "bootstrap", "loader", () => {
    let tmpPath;
    let eofBuilder;

    beforeEach(async () => {
        eofBuilder = new EOFBuilder();
        tmpPath = await fs.tmpName();
        await fs.mkdir(tmpPath);
    });

    afterEach(async () => {
        await fs.remove(tmpPath);
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

    it("should throw if init section is empty", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // modify in common header
        eofBuilder.header.writeUInt32BE(0, 24);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /Empty 'init' section/);
    });

    it("should throw if type is not specified", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // // modify mount name
        eofBuilder.volumes[0].header.writeUInt16BE(0, 30);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /No filesystem type for/);
    });

    it("should throw if name is not prefixed with '/'", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        // modify mount name
        eofBuilder.volumes[0].header.write("dapp", 24, 4);
        await writeExecFile(execPath, eofBuilder);
        await assert.throws(async () => protoBootstraper(execPath), Error, /nvalid volume mount name/);
    });

    it("set 'type'", async () => {
        const eofBuilder = await getSimpleBuilder({ 
            type: "aaa"
        });
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);
        const volumes = await protoBootstraper(execPath, {
            result: true
        });
        assert.equal(volumes.get("/app").type, "aaa");
    });

    it("set 'mapping'", async () => {
        const eofBuilder = await getSimpleBuilder({ 
            mapping: "adone"
        });
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);
        const volumes = await protoBootstraper(execPath, {
            result: true
        });
        assert.equal(volumes.get("/app").mapping, "adone");
    });

    it("set 'index'", async () => {
        const eofBuilder = await getSimpleBuilder({ 
            mapping: "adone",
            index: "some_index.file.js"
        });
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);
        const volumes = await protoBootstraper(execPath, {
            result: true
        });
        assert.equal(volumes.get("/app").mapping, "adone");
        assert.equal(volumes.get("/app").index, "some_index.file.js");
    });
});
