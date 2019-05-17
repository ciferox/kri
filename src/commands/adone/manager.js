const {
    error,
    is,
    fs,
    nodejs,
    github,
    path: aPath,
    util
} = adone;

export default class ADONEManager {
    constructor({ realm, cache } = {}) {
        this.cache = new nodejs.FsCache({
            downloads: "downloads",
            release: "releases",
            ...cache,
            realm,
            appName: "adone"
        });
    }

    async getVersions() {
        const relManager = new github.GitHubReleaseManager({ owner: "ciferox", repo: "adone" });
        return (await relManager.listReleases()).map((rel) => ({
            version: rel.tag_name,
            date: rel.published_at.slice(0, 10)
        }));
    }

    async getCachePath(...dirs) {
        return this.cache.getPath(...dirs);
    }

    async getDownloadedVersions({ type } = {}) {
        const cachePath = await this.getCachePath(this.cache.downloads);
        const files = await fs.readdir(cachePath);

        const result = [];

        for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            const name = await nodejs.getArchiveName({ type, version: file.slice(5) });
            // eslint-disable-next-line no-await-in-loop
            if (await fs.pathExists(aPath.join(cachePath, file, name))) {
                const reStr = `^adone-(v\\d+\\.\\d+\\.\\d+)-node-v${process.version.split(".")[0].slice(1)}\\.x-.+`;
                result.push((new RegExp(reStr)).exec(name)[[1]]);
            }
        }

        return result;
    }

    getArchiveName({ version, nodeVersion, platform = nodejs.getCurrentPlatform(), arch = nodejs.getCurrentArch(), ext = nodejs.DEFAULT_EXT } = {}) {
        let result = `adone-${version}-node-v${nodeVersion}.x`;
        if (platform) {
            result += `-${platform}`;
        }
        if (arch) {
            result += `-${arch}`;
        }
        if (ext) {
            result += ext;
        }

        return result;
    }

    async checkVersion(version) {
        if (!version || version === "latest") {
            const releases = await this.getVersions();
            return releases[0].version;
        }
        if (!version.startsWith("v")) {
            return `v${version}`;
        }
        return version;
    }

    async checkNodejsVersion(nodeVersion) {
        if (!nodeVersion) {
            return process.version.split(".")[0].slice(1);
        } else if (!is.numeral(nodeVersion)) {
            throw new error.NotValidException(`Invalid Node.js version: ${nodeVersion}`);
        }
        return nodeVersion;
    }

    /**
     * Tries download Node.js archive from official site.
     * 
     * @param {*} param0 
     * @returns {Object { path, downloaded }} 
     */
    async download({ version, nodeVersion, outPath, force = false, progressBar = false, platform = nodejs.getCurrentPlatform(), arch = nodejs.getCurrentArch(), ext = nodejs.DEFAULT_EXT, hash } = {}) {
        version = await this.checkVersion(version);
        nodeVersion = await this.checkNodejsVersion(nodeVersion);

        const archName = this.getArchiveName({ version, nodeVersion, platform, arch, ext });
        const downloadPath = aPath.join(await this.getCachePath(this.cache.downloads), this.getArchiveName({ version, nodeVersion, platform: "", arch: "", ext: "" }));

        if (!is.string(outPath) || outPath.length === 0) {
            outPath = downloadPath;
        }

        const fullPath = aPath.join(outPath, archName);

        const result = {
            path: fullPath,
            downloaded: false
        };

        if (outPath === downloadPath && !force && await fs.pathExists(fullPath)) {
            result.downloaded = true;
            return result;
        }

        const url = `https://github.com/ciferox/adone/releases/download/${version}/${archName}`;
        const downloader = new adone.http.Downloader({
            url,
            dest: fullPath
        });

        if (progressBar instanceof adone.cli.Progress) {
            progressBar.clean = true;
        } else if (progressBar === true) {
            progressBar = new adone.cli.Progress({
                clean: true,
                schema: "[:bar] :current/:total :percent"
            });
            progressBar.update(0);
        }

        if (progressBar) {
            const progress = util.throttle.create((current, total) => {
                progressBar.update(current / total, {
                    current: adone.pretty.size(current),
                    total: adone.pretty.size(total)
                });
            }, { drop: true, dropLast: false, max: 1, interval: 100 });

            downloader.on("bytes", (current, total) => progress(current, total));
        }

        try {
            const hashsum = await downloader.download(hash);
            await adone.promise.delay(500);
            result.downloaded = true;
            if (hash) {
                result.hashsum = hashsum;
            }
        } catch (err) {
            progressBar && progressBar.destroy();
            throw err;
        }

        return result;
    }

    async extract({ outPath, version, nodeVersion, platform, arch, type = "release", ext } = {}) {
        version = await this.checkVersion(version);
        nodeVersion = await this.checkNodejsVersion(nodeVersion);

        const destPath = outPath || await this.getCachePath(this.cache[type]);

        const archName = this.getArchiveName({ version, nodeVersion, type, platform, arch, ext });
        const downloadPath = aPath.join(await this.getCachePath(this.cache.downloads), this.getArchiveName({ version, nodeVersion, ext: "", platform: "", arch: "" }));

        const fullPath = aPath.join(downloadPath, archName);
        if (!(await fs.pathExists(fullPath))) {
            throw new error.NotExistsException(`Path '${fullPath}' is not exist`);
        }
        const fullDestPath = aPath.join(destPath, this.getArchiveName({ version, nodeVersion, platform, arch, type, ext: "" }));

        if (!(await fs.pathExists(fullDestPath))) {
            await adone.fast.src(fullPath)
                .extract()
                .dest(fullDestPath);
        }

        return fullDestPath;
    }

    async removeActive() {
        try {
            // const basePath = await nodejs.getPrefixPath();

            // for (const dirs of NODEJS_PATHS) {
            //     // eslint-disable-next-line no-await-in-loop
            //     await fs.remove(aPath.join(basePath, ...dirs));
            // }
        } catch (err) {
            // ADONE is not installed
        }
    }
}
