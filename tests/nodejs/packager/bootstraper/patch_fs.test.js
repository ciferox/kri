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
        const origContent = await fs.readFile(join(appPath, "index.js"), "utf8");
        await fs.rm(appPath);

        const kriFs = kri.fs;
        protoBootstraper(execPath);
        if (!kriFs.isNativePatched()) {
            throw new Error("Native fs is not patched");
        }

        if (kriFs.readFileSync("/app/index.js", "utf8") !== origContent) {
            kriFs.unpatchNative();
            throw new Error("Readed content is not equal to expected one");
        }

        kriFs.unpatchNative();

        if (kriFs.isNativePatched()) {
            throw new Error("Native should be unpatched");
        }
    });
});

