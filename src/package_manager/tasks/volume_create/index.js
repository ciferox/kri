const {
    is,
    fast,
    fs: { readFile, tmpName, remove },
    realm,
    task: { IsomorphicTask, task },
    path
} = adone;

const getATags = (publishInfo, type) => {
    return (!publishInfo || !publishInfo.artifacts)
        ? null
        : publishInfo.artifacts[type];
};

@task("volumeCreate")
export default class extends IsomorphicTask {
    async main({ input, startup, version, nodePath } = {}) {
        const tmpPath = await tmpName();

        let filename;

        let name;
        let index;
        if (is.realm(input)) {
            filename = `${input.name}.zip`;

            const targetRealm = await realm.rootRealm.runAndWait("realmFork", {
                realm: input,
                name: input.name,
                path: tmpPath,
                tags: getATags(input.devConfig.raw.publish, "dev")
            });

            const nodeModules = targetRealm.devConfig.raw.publish.nodeModules;
            if (nodeModules) {
                const options = {
                    cwd: targetRealm.cwd
                };
                if (is.object(nodeModules)) {
                    options.modules = nodeModules;
                }
                options.dev = true;
                // install npm modules needed for building
                await realm.rootRealm.runAndWait("installModules", options);
            }

            // build realm using bundled Node.js
            const child = adone.process.exec(nodePath, [path.join(__dirname, "build.js"), adone.cwd, targetRealm.cwd])
            child.stderr.pipe(process.stderr);
            await child;

            await realm.rootRealm.runAndWait("realmPack", {
                type: ".zip",
                name: input.name,
                realm: targetRealm,
                tags: getATags(targetRealm.devConfig.raw.publish, "rel"),
                path: tmpPath,
                filter: [
                    "!**/*.js.map",
                    ...(targetRealm.devConfig.raw.publish.filter || [])
                ]
            });

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

        await remove(tmpPath);

        return { name, filename, index, volume };
    }
}
