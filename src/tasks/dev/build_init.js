const {
    fs,
    task: { IsomorphicTask, task },
    path: { join, basename }
} = adone;

@task("buildInit")
export default class extends IsomorphicTask {
    async main({ src, dst, save = true } = {}) {
        const bundle = await adone.rollup.rollup({
            onwarn: adone.noop,
            input: join(this.manager.cwd, src),
            plugins: [
                adone.rollup.plugin.babel({
                    plugins: [
                        "@babel/plugin-proposal-class-properties"
                    ]
                }),
                adone.rollup.plugin.resolve({
                    preferBuiltins: true,
                    customResolveOptions: {
                        basedir: adone.path.join(adone.cwd, "src", "glosses", "fs", "custom")
                    }
                }),
                adone.rollup.plugin.commonjs(),
                adone.rollup.plugin.cleanup({
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

        return (save
            ? fs.writeFile(join(this.manager.cwd, dst, basename(src)), output[0].code, "utf8")
            : output[0].code);
    }
}
