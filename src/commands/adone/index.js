import ADONEManager from "./manager";

const {
    cli,
    is,
    error,
    fs,
    app: {
        Subsystem,
        command
    },
    path: aPath,
    pretty
} = adone;
const { chalk, style, chalkify } = cli;

const versionRegex = /^v\d+\.\d+\.\d+/;

const activeStyle = chalkify("bold.underline", chalk);
const cachedStyle = chalkify("#388E3C", chalk);
const inactiveStyle = chalkify("white", chalk);
const bullet = `${adone.text.unicode.symbol.bullet} `;
const indent = " ".repeat(bullet.length);

const getCurrentVersion = async () => {
    try {
        const exePath = await fs.which("adone");
        return adone.process.execStdout(exePath, ["--version"]);
    } catch (err) {
        return "";
    }
};

export default class ADONECommand extends Subsystem {
    onConfigure() {
        this.adoneManager = new ADONEManager({
            realm: kri.realm
        });

        this.log = this.root.log;
    }

    @command({
        name: ["list", "ls"],
        description: "Show ADONE releases",
        options: [
            {
                name: ["--date", "-D"],
                description: "Show release date"
            }
        ]
    })
    async list(args, opts) {
        try {
            const options = opts.getAll();

            this.log({
                message: "collecting release information"
            });
            const releases = await this.adoneManager.getVersions();
            const currentVersion = await getCurrentVersion();
            const downloadedVersions = await this.adoneManager.getDownloadedVersions();

            const styledItem = (item) => {
                let result = inactiveStyle(item.version);
                const isCurrent = item.version === currentVersion;

                if (isCurrent) {
                    result = `${bullet}${`${activeStyle(item.version)}`}`;
                } else {
                    result = `${indent}${item.version}`;
                }

                if (downloadedVersions.includes(item.version)) {
                    result = cachedStyle(result);
                }
                return result;
            };

            const model = [
                {
                    id: "version",
                    handle: (item) => `${styledItem(item)}${item.lts ? chalk.grey(" (LTS)") : ""}`
                }
            ];

            if (options.date) {
                model.push({
                    id: "date",
                    width: 12,
                    align: "right",
                    handle: (item) => chalk.grey(item.date)
                });
            }

            this.log({
                message: "done",
                clean: true,
                status: true
            });

            console.log(pretty.table(releases, {
                borderless: true,
                noHeader: true,
                style: {
                    head: null,
                    "padding-left": 1,
                    compact: true
                },
                model
            }));

            return 0;
        } catch (err) {
            this.log({
                message: err.message,
                status: false,
                // clean: true
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "spawn",
        description: "Spawn ADONE realm",
        options: [
            {
                name: ["--source", "-S"],
                type: String,
                description: "Source of packed realm: 'kri', 'vX.Y.Z', local absolute ('/absolute/path') or relative ('./relative/path') path or github repo path ('ciferox/adone')"
            },
            {
                name: ["--dir-name", "-D"],
                type: String,
                default: "adone",
                description: "Directory name"
            },
            {
                name: ["--path", "-P"],
                type: String,
                default: adone.system.env.home(),
                description: "Destination path"
            },
            {
                name: ["--module-name", "-M"],
                type: String,
                default: "adone",
                description: "Global module name associated with spawned realm"
            },
            {
                name: ["--global", "-G"],
                type: String,
                description: "Global executable name of ADONE cli"
            },
            {
                name: "--node-version",
                type: String,
                default: process.version.split(".")[0].slice(1),
                description: "Node.js version"
            },
            {
                name: "--fresh",
                description: "Force download and extract"
            }
        ]
    })
    async spawn(args, opts) {
        const options = opts.getAll();
        const { source, nodeVersion, path, dirName, moduleName } = options;

        const destPath = aPath.resolve(path, dirName);

        let canUndo = false;
        let moduleLinkPath;
        try {
            if (await fs.pathExists(destPath)) {
                throw new error.ExistsException(`Path '${destPath}' already exists`);
            }

            canUndo = true;

            let adoneSrcPath;
            if (source === "latest" || versionRegex.test(source)) {
                const relInfo = {
                    version: source,
                    nodeVersion
                };
                await this.adoneManager.download({
                    ...relInfo,
                    progressBar: true,
                    force: options.fresh
                });

                this.log({
                    message: "extracting files"
                });
                adoneSrcPath = await this.adoneManager.extract({
                    relInfo,
                    force: options.fresh
                });
            } else if (source === "kri") {
                // extract bundled ADONE realm

                this.log({
                    message: "extracting files from KRI"
                });

                adoneSrcPath = "/adone";
            }

            await fs.copyEx(adoneSrcPath, destPath, {
                results: false,
                dot: true,
                junk: true
            });

            moduleLinkPath = aPath.join(adone.system.env.home(), ".node_modules", moduleName);
            await this._createSymlink(destPath, moduleLinkPath);


            let message;
            if (is.string(options.global) && options.global.trim().length > 0) {
                await this._createSymlink(aPath.join(destPath, "bin", "adone"), aPath.join(aPath.dirname(process.execPath), options.global.trim()));
                message = "done";
            } else {
                message = `note: to run ADONE/cli from anywhere add ${style.primary(aPath.join(destPath, "bin"))} to PATH variable\ndone`;
            }

            this.log({
                message,
                status: true
            });

            return 0;
        } catch (err) {
            this.log({
                message: err.message,
                status: false,
                clean: true
            });
            console.error(adone.pretty.error(err));

            if (canUndo) {
                await fs.remove(destPath);
                if (is.string(moduleLinkPath)) {
                    await fs.unlink(moduleLinkPath);
                }
            }
            return 1;
        }
    }

    async _createSymlink(targetPath, path) {
        await fs.mkdirp(aPath.dirname(path));
        if (is.windows) {
            await fs.symlink(targetPath, path, "junction");
        } else {
            await fs.symlink(targetPath, path);
        }
    }
}
