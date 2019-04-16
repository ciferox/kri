import protoBootstraper from "./proto";
import { getSimpleBuilder, volumePath } from "./helpers";

const {
    fs,
    std: { path: { join } }
} = adone;

const writeExecFile = (execPath, eofBuilder) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(execPath);
    eofBuilder.toStream()
        .pipe(ws)
        .on("close", resolve)
        .on("error", reject);
});

describe("nodejs", "packager", "bootstraper", () => {
    let tmpPath;

    beforeEach(async () => {
        tmpPath = await fs.tmpName();
        await fs.mkdir(tmpPath);
    });

    afterEach(async () => {
        await fs.rm(tmpPath);
    });

    it("should define global object after volumes loaded", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);
        await protoBootstraper(execPath, "volumes:loaded");

        assert.exists(global.__kri_loader__);
        assert.lengthOf(global.__kri_loader__.volumes, 1);
        assert.equal(global.__kri_loader__.volumes[0].name, "/app");
        assert.equal(global.__kri_loader__.volumes[0].index, "index.js");
        assert.deepEqual(global.__kri_loader__.volumes[0].data, await fs.readFile(volumePath("app.zip")));

        delete global.__kri_loader__;
    });
});

