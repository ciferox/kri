const {
    cli,
    app: {
        Subsystem,
        command
    }
} = adone;

const { nodejs } = kri;


export default class PackageCommand extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager();
    }

    @command({
        name: "create",
        description: "Create package",
        options: [
            {
                name: "--version",
                type: String,
                default: "latest",
                description: "Node.js version ('latest', 'latest-lts', '11.0.0', 'v10.15.3', ...)"
            },
            {
                name: "--config",
                type: String,
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
                type: String,
                default: null,
                description: "Path to single-file bundle as entry point"
            }
        ]
    })
    async create(args, opts) {
        try {
            const packager = new nodejs.NodejsPackager({
                make: ["-j8"],
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
                        cli.updateProgress({
                            status: true,
                            clean: true
                        });
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
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }
}
