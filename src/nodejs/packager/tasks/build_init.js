import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";

const {
    fs,
    task: { IsomorphicTask, task },
    std: { path: { join } }
} = adone;

@task("buildInit")
export default class extends IsomorphicTask {
    async main({ cwd, path } = {}) {
        this.manager.log({
            message: "building 'init'"
        });

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

        const result = [
            output[0].code,
            await fs.readFile(path, "utf8")
        ].join("\n");

        this.manager.log({
            message: "'init' successfully builded",
            status: true
        });

        return result;
    }
}
