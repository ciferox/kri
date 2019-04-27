const {
    cli,
    is,
    app: {
        Subsystem,
        command
    },
    nodejs
} = adone;

export default class PackageCommand extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager(kri.PACKAGER_CONFIG);
    }

    @command({
        name: "create",
        description: "Create package",
        arguments: [
            {
                name: "input",
                type: String,
                required: true,
                description: "Path to application script/realm or 'self' for self-packaging"
            }
        ],
        options: [
            {
                name: ["--out", "-O"],
                type: String,
                default: process.cwd(),
                description: "Package output path"
            },
            {
                name: ["--name", "-N"],
                type: String,
                description: "Package output name (default: basename of the input file)"
            },
            {
                name: ["--version", "-V"],
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            },
            {
                name: "--config",
                type: String,
                default: null,
                description: "Path to packager configuration file"
            },
            {
                name: "--fresh",
                description: "Force download and extract"
            },
            {
                name: "--force-configure",
                description: "Force configure"
            },
            {
                name: "--force-build",
                description: "Force build"
            },
            {
                name: "--whole-core",
                description: "Embed whole core-realm"
            },
            {
                name: "--easy",
                description: "Interpret 'input' as bootstraper (not compatible with 'self' case)"
            },
            {
                name: "--verbose",
                description: "Show details"
            }
        ]
    })
    async create(args, opts) {
        try {
            const packager = new kri.packager.NodejsPackager({
                input: args.get("input"),
                ...opts.getAll(),
                manager: this.nodejsManager,
                log: (options) => {
                    if (options.stderr) {
                        cli.updateProgress({
                            status: false,
                            clean: true
                        });
                        console.error(options.stderr);
                    } else if (options.stdout) {
                        if (!is.undefined(options.status) && !is.undefined(options.clean)) {
                            cli.updateProgress(options);
                        }
                        console.log(options.stdout);
                    } else {
                        cli.updateProgress(options);
                    }
                }
            });

            await packager.create();

            cli.updateProgress({
                message: "done",
                status: true,
                // clean: true
            });

            // console.log(adone.inspect(result, { style: "color" }));

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false,
                clean: true
            });
            console.log(adone.pretty.error(err));
            return 1;
        }
    }
}
