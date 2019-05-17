const {
    cli,
    fs,
    app: {
        Subsystem,
        command
    },
    nodejs,
    semver,
    pretty
} = adone;
const { chalk, style, chalkify } = cli;

const activeStyle = chalkify("bold.underline", chalk);
const cachedStyle = chalkify("#388E3C", chalk);
const inactiveStyle = chalkify("white", chalk);
const bullet = `${adone.text.unicode.symbol.bullet} `;
const indent = " ".repeat(bullet.length);

export default () => class NodeCommand extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager({
            realm: kri.realm
        });

        this.log = this.root.log;
    }

    @command({
        name: ["list", "ls"],
        description: "Show Node.js releases",
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
            this.log({
                message: "collecting release information"
            });

            const indexJson = await nodejs.getReleases();
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

            this.log({
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
        name: ["download", "get"],
        description: "Download Node.js",
        options: [
            {
                name: ["--version", "-V"],
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            },
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
            const options = opts.getAll();
            this.log({
                message: "checking version"
            });

            options.version = await nodejs.checkVersion(options.version);

            this.log({
                message: `downloading Node.js ${style.accent(options.version)}`
            });

            const result = await this.nodejsManager.download({
                progressBar: true,
                ...options
            });

            if (result.downloaded) {
                this.log({
                    message: `saved to ${style.accent(result.path)}`,
                    status: true
                });
            } else {
                this.log({
                    message: `already downloaded: ${style.accent(result.path)}`,
                    status: true
                });
            }

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
        name: "extract",
        description: "Extract cached Node.js",
        options: [
            {
                name: ["--version", "-V"],
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            },
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
            const options = opts.getAll();
            this.log({
                message: "checking version"
            });

            options.version = await nodejs.checkVersion(options.version);

            this.log({
                message: "extracting"
            });

            const destPath = await this.nodejsManager.extract(options);

            this.log({
                message: `Extracted to ${style.accent(destPath)}`,
                status: true
            });

            return 0;
        } catch (err) {
            this.log({
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
        options: [
            {
                name: ["--version", "-V"],
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            },
            {
                name: ["--force", "-F"],
                description: "Force activate"
            },
            {
                name: ["--skip-include", "-SI"],
                description: "Skip copying node `include` directory"
            },
            {
                name: ["--skip-lib", "-SL"],
                description: "Skip copying node `lib` directory (i.e. without `npm`)"
            }
        ]
    })
    async activate(args, opts) {
        try {
            const options = opts.getAll();
            this.log({
                message: "checking version"
            });

            const version = await nodejs.checkVersion(options.version);
            const currentVersion = await nodejs.getCurrentVersion();
            const prefixPath = await nodejs.getPrefixPath();

            if (version === currentVersion && !options.force) {
                this.log({
                    message: `Node.js ${style.primary(version)} is active`,
                    status: true
                });
            } else {
                this.log({
                    message: "waiting"
                });

                await this.nodejsManager.download({
                    version,
                    progressBar: true,
                    // force: options.force
                });

                this.log({
                    message: `unpacking ${style.accent(await nodejs.getArchiveName({ version }))}`
                });
                const unpackedPath = await this.nodejsManager.extract({ version });

                this.log({
                    message: "deleting Node.js files"
                });
                await this.nodejsManager.removeActive();

                this.log({
                    message: "copying new files"
                });

                const filter = [
                    "!LICENSE",
                    "!CHANGELOG.md",
                    "!README.md"
                ];
                if (options.skipInclude) {
                    filter.push("!include/**/*");
                } 
                if (options.skipLib) {
                    filter.push("!lib/**/*", "!bin/npm", "!bin/npx");
                }

                await fs.copyEx(unpackedPath, prefixPath, {
                    filter
                });

                this.log({
                    message: `Node.js ${style.primary(version)} successfully activated`,
                    status: true
                });
            }

            return 0;
        } catch (err) {
            this.log({
                message: err.message,
                status: false
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }

    @command({
        name: ["deactivate", "del"],
        description: "Dectivate/remove active Node.js"
    })
    async deactivate(args, opts) {
        try {
            const currentVersion = await nodejs.getCurrentVersion();

            if (!currentVersion) {
                this.log({
                    message: "Node.js not found",
                    status: true
                });
            } else {
                this.log({
                    message: "deleting Node.js files"
                });
                await this.nodejsManager.removeActive();
                this.log({
                    message: `Node.js ${style.primary(currentVersion)} successfully removed`,
                    status: true
                });
            }

            return 0;
        } catch (err) {
            this.log({
                message: err.message,
                status: false
            });
            // console.log(pretty.error(err));
            return 1;
        }
    }
};
