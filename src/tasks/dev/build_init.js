import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';

const {
    fs,
    task: { IsomorphicTask, task },
    path: { join, basename }
} = adone;

@task("buildInit")
export default class extends IsomorphicTask {
    async main({ src, dst } = {}) {
        const bundle = await rollup({
            onwarn: adone.noop,
            input: join(this.manager.cwd, src),
            plugins: [
                babel({
                    plugins: [
                        "@babel/plugin-proposal-class-properties"
                    ]
                }),
                resolve({
                    preferBuiltins: true,
                    customResolveOptions: {
                        basedir: adone.path.join(adone.cwd, "src", "glosses", "fs", "custom")
                    }
                }),
                commonjs(),
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
            // name: "kriFs",
            globals: {
                fs: "require('fs')",
                path: "require('path')",
                zlib: "require('zlib')",
                stream: "require('stream')"
            }
        });

        return fs.writeFile(join(this.manager.cwd, dst, basename(src)), output[0].code, "utf8");
    }
}
