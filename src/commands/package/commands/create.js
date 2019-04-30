const {
    cli,
    is,
    app: {
        Subsystem,
        mainCommand
    },
    nodejs
} = adone;

export default class extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager(kri.PACKAGER_CONFIG);
    }

    @mainCommand({
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
                description: "Path to kri-configuration file"
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
                name: "--verbose",
                description: "Show details"
            }
        ]
    })
    async create(args, opts) {
        try {
            const log = (options) => {
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
            };

            const kriConfig = await kri.KRIConfiguration.load({
                path: opts.get("config"),
                cwd: process.cwd()
            });

            log({
                message: "checking version"
            });
            const version = await nodejs.checkVersion(opts.get("version"));

            // TODO: Check minimum supported version

            log({
                stdout: `Node.js version: ${cli.style.primary(version)}`,
                status: true,
                clean: true
            });

            // console.log(version);

            const prebuiltManager = new kri.PrebuiltManager({
                nodeManager: this.nodejsManager,
                kriConfig,
                log
            });

            await prebuiltManager.initialize();

            const nodeBinPath = await prebuiltManager.get({
                version,
                fresh: opts.get("fresh"),
                forceConfigure: opts.get("forceConfigure"),
                forceBuild: opts.get("forceBuild")
            });

            const packageManager = new kri.PackageManager({
                input: args.get("input"),
                name: opts.get("name"),
                out: opts.get("out"),
                wholeCore: opts.get("wholeCore"),
                kriConfig,
                nodeBinPath,
                log
            });
            
            await packageManager.create();

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
