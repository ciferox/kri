import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";

const {
    fs,
    task: { IsomorphicTask, task },
    std: { path: { join } }
} = adone;

@task("generateLoader")
export default class PatchFile extends IsomorphicTask {
    async main({ cwd } = {}) {
        const bundle = await rollup({
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
            output: {
                format: "iife",
                name: "kriFs",
                globals: {
                    path: "require('path')",
                    buffer: "require('buffer')"
                }
            }
        });

        const loader = await fs.readFile(join(__dirname, "loader.js"), "utf8");
        
        return [
            output[0].code,
            loader
        ].join("\n");
    }
}
