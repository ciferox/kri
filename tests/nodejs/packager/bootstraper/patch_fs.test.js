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

    it("should patch fs module", async () => {
        const eofBuilder = await getSimpleBuilder();
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);

        const appPath = await fs.tmpName();
        await adone.fast.src(volumePath("app.zip"))
            .extract()
            .dest(appPath);
        // const origContent = await fs.readFile(join(appPath, "index.js"));
        await fs.rm(appPath);

        await protoBootstraper(execPath, "fs:patched");

        assert.exists(global.__kri_loader__.unpatchFs);

        global.__kri_loader__.unpatchFs();

        delete global.__kri_loader__;

    });
});

