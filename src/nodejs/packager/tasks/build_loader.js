import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";

const {
    fs,
    task: { IsomorphicTask, task },
    std: { path: { join } }
} = adone;

@task("buildLoader")
export default class PatchFile extends IsomorphicTask {
    async main({ cwd, path } = {}) {
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

        const bootstrap = await fs.readFile(path, "utf8");

        return [
            output[0].code,
            bootstrap
        ].join("\n");
    }
}
