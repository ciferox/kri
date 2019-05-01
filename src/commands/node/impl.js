const {
    cli,
    fs,
    app: {
        Subsystem,
        command
    },
    nodejs,
    semver,
    pretty,
    std
} = adone;
const { chalk, style, chalkify } = cli;

const activeStyle = chalkify("bold.underline", chalk);
const cachedStyle = chalkify("#388E3C", chalk);
const inactiveStyle = chalkify("white", chalk);
const bullet = `${adone.text.unicode.symbol.bullet} `;
const indent = " ".repeat(bullet.length);

const IGNORE_FILES = ["LICENSE", "CHANGELOG.md", "README.md"];

export default () => class NodeCommand extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager({
            realm: kri.realm
        });
    }

    @command({
        name: ["list", "ls"],
        description: "Display Node.js releases",
        options: [
            {
                name: ["--all", "-A"],
                description: "Show all versions instead of supported"
            },
            {
                name: ["--date", "-D"],
                description: "Show release date"
            }
        ]
    })
    async list(args, opts) {
        try {
            cli.updateProgress({
                message: `downloading ${style.accent("index.json")}`
            });
            const indexJson = await nodejs.getReleases();

            cli.updateProgress({
                message: "checking cached versions"
            });

            const options = opts.getAll();

            const items = indexJson.filter((item) => options.all
                ? true
                : semver.satisfies(item.version.substr(1), adone.package.engines.node, false));
            
            const currentVersion = await nodejs.getCurrentVersion();

            const downloadedVersions = await this.nodejsManager.getDownloadedVersions();

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

            cli.updateProgress({
                message: "done",
                clean: true,
                status: true
            });

            console.log(pretty.table(items, {
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
            cli.updateProgress({
                message: err.message,
                status: false,
                // clean: true
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }

    @command({
        name: ["download", "get"],
        description: "Download Node.js",
        arguments: [
            {
                name: "version",
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            }
        ],
        options: [
            {
                name: ["--type", "-T"],
                description: "Distribution type",
                choices: ["release", "sources", "headers"],
                default: "release"
            },
            {
                name: ["--platform", "-P"],
                description: "Platform name",
                choices: ["linux", "win", "darwin", "sunos", "aix"],
                default: nodejs.getCurrentPlatform()
            },
            {
                name: ["--arch", "-A"],
                description: "CPU architecture",
                choices: ["x64", "x86", "arm64", "armv7l", "armv6l", "ppc64le", "ppc64", "s390x"],
                default: nodejs.getCurrentArch()
            },
            {
                name: ["--ext", "-E"],
                description: "Archive extension",
                type: String,
                default: nodejs.DEFAULT_EXT
            },
            {
                name: ["--force", "-F"],
                description: "Force download"
            },
            {
                name: ["--out-path", "-O"],
                type: String,
                description: "Output path"
            }
        ]
    })
    async download(args, opts) {
        try {
            cli.updateProgress({
                message: "checking version"
            });

            const version = await nodejs.checkVersion(args.get("version"));

            cli.updateProgress({
                message: `downloading Node.js ${style.accent(version)}`
            });

            const result = await this.nodejsManager.download({
                version,
                progressBar: true,
                ...opts.getAll()
            });

            if (result.downloaded) {
                cli.updateProgress({
                    message: `saved to ${style.accent(result.path)}`,
                    status: true
                });
            } else {
                cli.updateProgress({
                    message: `already downloaded: ${style.accent(result.path)}`,
                    status: true
                });
            }

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false,
                // clean: true
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "extract",
        description: "Extract cached Node.js",
        arguments: [
            {
                name: "version",
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            }
        ],
        options: [
            {
                name: ["--type", "-T"],
                description: "Distribution type",
                choices: ["release", "sources", "headers"],
                default: "release"
            },
            {
                name: ["--platform", "-P"],
                description: "Platform name",
                choices: ["linux", "win", "darwin", "sunos", "aix"],
                default: nodejs.getCurrentPlatform()
            },
            {
                name: ["--arch", "-A"],
                description: "CPU architecture",
                choices: ["x64", "x86", "arm64", "armv7l", "armv6l", "ppc64le", "ppc64", "s390x"],
                default: nodejs.getCurrentArch()
            },
            {
                name: ["--ext", "-E"],
                description: "Archive extension",
                type: String,
                default: nodejs.DEFAULT_EXT
            },
            {
                name: ["--force", "-F"],
                description: "Force download"
            },
            {
                name: ["--out-path", "-O"],
                type: String,
                description: "Output path"
            }
        ]
    })
    async extract(args, opts) {
        try {
            cli.updateProgress({
                message: "checking version"
            });

            const version = await nodejs.checkVersion(args.get("version"));

            cli.updateProgress({
                message: "extracting"
            });

            const destPath = await this.nodejsManager.extract({
                version,
                ...opts.getAll()
            });

            cli.updateProgress({
                message: `Extracted to ${style.accent(destPath)}`,
                status: true
            });

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "activate",
        description: "Activate Node.js",
        arguments: [
            {
                name: "version",
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            }
        ],
        options: [
            {
                name: ["--force", "-F"],
                description: "Force download"
            }
        ]
    })
    async activate(args, opts) {
        try {
            cli.updateProgress({
                message: "checking version"
            });

            const version = await nodejs.checkVersion(args.get("version"));
            const currentVersion = await nodejs.getCurrentVersion();
            const prefixPath = await nodejs.getPrefixPath();

            if (version === currentVersion) {
                cli.updateProgress({
                    message: `Node.js ${style.primary(version)} is active`,
                    status: true
                });
            } else {
                cli.updateProgress({
                    message: "waiting"
                });

                await this.nodejsManager.download({
                    version,
                    progressBar: true
                });

                cli.updateProgress({
                    message: `unpacking ${style.accent(await nodejs.getArchiveName({ version }))}`
                });
                const unpackedPath = await this.nodejsManager.extract({ version });

                cli.updateProgress({
                    message: "deleting previous files"
                });
                await this.nodejsManager.deleteCurrent();

                cli.updateProgress({
                    message: "copying new files"
                });

                await fs.copyEx(unpackedPath, prefixPath, {
                    filter: (src, item) => !IGNORE_FILES.includes(item)
                });

                await fs.remove(std.path.dirname(unpackedPath));

                cli.updateProgress({
                    message: `Node.js ${style.primary(version)} successfully activated`,
                    status: true
                });
            }

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }
};
