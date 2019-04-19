import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";
import protoBootstraper from "../proto";
import { getSimpleBuilder, volumePath, writeExecFile } from "../helpers";

const {
    fs,
    std: { path: { join } }
} = adone;

const initMount = `
module.exports = (volumes, startupFile) => {
    kriFs.mountVolumes(volumes);
    return kriFs;
};
`;

const initMountPatch = `
module.exports = (volumes, startupFile) => {
    kriFs.mountVolumes(volumes);
    kriFs.patchNative();
    return kriFs;
};
`;


describe("nodejs", "packager", "bootstrap", "init", () => {
    let kriFs;
    let tmpPath;

    const getInit = (code) => [
        kriFs,
        code
    ].join("\n");

    before(async () => {
        const bundle = await rollup({
            onwarn: adone.noop,
            input: join(kri.ROOT_PATH, "src", "fs", "index.js"),
            plugins: [
                cleanup({
                    comments: "none",
                    sourcemap: false,
                    extensions: ["js"]
                })
            ]
        });

        const { output } = await bundle.generate({
            format: "iife",
            compact: true,
            name: "kriFs",
            globals: {
                fs: "require('fs')",
                path: "require('path')",
                buffer: "require('buffer')"
            }
        });

        kriFs = output[0].code;
    });

    beforeEach(async () => {
        tmpPath = await fs.tmpName();
        await fs.mkdir(tmpPath);
    });

    afterEach(async () => {
        await fs.rm(tmpPath);
    });

    it("should mount volumes", async () => {
        const eofBuilder = await getSimpleBuilder({ init: getInit(initMount) });
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);
        const kriFs = protoBootstraper(execPath);

        const appPath = await fs.tmpName();
        await adone.fast.src(volumePath("app.zip"))
            .extract()
            .dest(appPath);

        assert.equal(kriFs.readFileSync("/app/index.js", "utf8"), await fs.readFile(join(appPath, "index.js"), "utf8"));

        await fs.rm(appPath);
    });

    it("should patch fs module", async () => {
        const eofBuilder = await getSimpleBuilder({ init: getInit(initMountPatch) });
        const execPath = join(tmpPath, "exec");

        await writeExecFile(execPath, eofBuilder);

        const appPath = await fs.tmpName();
        await adone.fast.src(volumePath("app.zip"))
            .extract()
            .dest(appPath);
        const origContent = await fs.readFile(join(appPath, "index.js"), "utf8");
        await fs.rm(appPath);

        const kriFs = protoBootstraper(execPath);

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
