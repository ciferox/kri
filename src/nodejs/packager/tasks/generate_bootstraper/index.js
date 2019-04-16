import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";

const {
    fs,
    task: { IsomorphicTask, task },
    std: { path: { join } }
} = adone;

@task("generateBootstraper")
export default class PatchFile extends IsomorphicTask {
    async main({ cwd } = {}) {
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
                path: "require('path')",
                buffer: "require('buffer')"
            }
        });

        const bootstrap = await fs.readFile(join(__dirname, "bootstrap.asset.js"), "utf8");

        return [
            output[0].code,
            bootstrap
        ].join("\n");
    }
}
