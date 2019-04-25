import { rollup } from "rollup";
import cleanup from "rollup-plugin-cleanup";
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';

const {
    fs,
    task: { IsomorphicTask, task },
    path: { join }
} = adone;

@task("buildInit")
export default class extends IsomorphicTask {
    async main({ cwd } = {}) {
        this.manager.log({
            message: "building 'init'"
        });

        const bundle = await rollup({
            // onwarn: adone.noop,
            input: join(kri.ROOT_PATH, "src", "nodejs", "packager", "assets", "init.js"),
            plugins: [
                babel({
                    plugins: [
                        "@babel/plugin-proposal-class-properties"
                    ]
                }),
                resolve({
                    preferBuiltins: true,
                    customResolveOptions: {
                        basedir: adone.path.join(adone.ROOT_PATH, "src", "glosses", "fs2", "custom"),
                        // moduleDirectory: [
                        //     adone.path.join(adone.ROOT_PATH, "src"),
                        //     adone.path.join(adone.ROOT_PATH, "src", "glosses"),
                        //     adone.path.join(adone.ROOT_PATH, "src", "glosses", "fs2"),
                        // ]
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

        this.manager.log({
            message: "'init' successfully builded",
            status: true
        });

        return output[0].code;
    }
}
