const {
    is,
    fast,
    fs: { readFile, tmpName, rm, mkdirp },
    realm,
    task: { IsomorphicTask, task },
    std: { path },
    util
} = adone;

@task("volumeCreate")
export default class extends IsomorphicTask {
    async main({ input, startup } = {}) {
        const tmpPath = await tmpName();

        let filename;

        let name;
        let index;
        if (is.realm(input)) {
            filename = `${input.name}.zip`;

            // Ignore some dev files
            const ignores = [
                "kri",
                "dev"
            ];

            const basePath = path.join(input.cwd, ".adone");
            const filenames = [];
            for (const i of ignores) {
                try {
                    filenames.push(path.relative(basePath, adone.std.module._resolveFilename(path.join(basePath, i))));
                } catch (err) {
                    //
                }
            }

            let filter;
            if (filenames.length > 1) {
                filter = `!.adone/{${filenames.join(",")}}`;
            } else {
                filter = `!.adone/${filenames.join(",")}`;
            }

            let kriConfig;
            try {
                kriConfig = adone.require(path.join(input.getPath(".adone", "kri")));
                if (kriConfig.default) {
                    kriConfig = kriConfig.default;
                }
            } catch (err) {
                //
            }

            const targetRealm = await realm.rootRealm.runAndWait("realmFork", {
                realm: input,
                name: input.name,
                path: tmpPath,
                artifactTags: kriConfig.realm ? kriConfig.realm.artifactTags : [],
                filter
            });

            // create temp dev config
            await this.createDevConfig(targetRealm.getPath());

            // build realm
            await targetRealm.connect({ transpile: true });
            await targetRealm.runAndWait("build");

            // remove src dir
            await rm(targetRealm.getPath("src"));

            await fast.src([
                "**/*",
                "!**/*.js.map",
                "!.adone/dev.json"
            ], { cwd: targetRealm.cwd })
                .pack("zip", filename)
                .dest(tmpPath);

            name = targetRealm.name;
            if (startup) {
                index = targetRealm.package.bin
            } else {
                index = targetRealm.package.main
            }

            if (!index) {
                throw new error.NotValidException(`Invalid index filename: ${index}`);
            }
        } else {
            filename = "app.zip";
            // single script
            await fast.src(input)
                .rename("index.js")
                .pack("zip", filename)
                .dest(tmpPath);

            name = "app";
            index = "index.js";
        }

        const volume = await readFile(path.join(tmpPath, filename));

        await rm(tmpPath);

        return { name, filename, index, volume };
    }

    async createDevConfig(cwd) {
        const config = new realm.DevConfiguration({
            cwd
        });
        config.set("superRealm", realm.rootRealm.cwd);
        await config.save();
    }
}
