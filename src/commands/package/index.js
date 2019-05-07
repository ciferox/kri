const {
    cli,
    app: {
        Subsystem,
        mainCommand
    },
    nodejs
} = adone;

export default class PackageCommand extends Subsystem {
    onConfigure() {
        this.nodejsManager = new nodejs.NodejsManager({
            realm: kri.realm
        });

        this.log = this.root.log;
    }

    @mainCommand({
        arguments: [
            {
                name: "path",
                type: String,
                required: true,
                description: "Path to realm for packaging"
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
                default: null,
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
                name: "--verbose",
                description: "Show details"
            }
        ]
    })
    async create(args, opts) {
        try {
            const kriConfig = await kri.KRIConfiguration.load({
                path: opts.get("config"),
                cwd: process.cwd()
            });

            this.log({
                message: "checking version"
            });
            const version = await nodejs.checkVersion(opts.get("version"));

            if (!adone.semver.satisfies(version.substr(1), kri.package.engines.node, false)) {
                throw new adone.error.NotSupportedException(`Node.js ${version} is not supported. Use version that satisfies ${cli.style.accent(kri.package.engines.node)}`);
            }

            this.log({
                stdout: `Node.js version: ${cli.style.primary(version)}`,
                status: true,
                clean: true
            });

            const prebuiltManager = new kri.PrebuiltManager({
                nodeManager: this.nodejsManager,
                kriConfig,
                fresh: opts.get("fresh"),
                forceConfigure: opts.get("forceConfigure"),
                forceBuild: opts.get("forceBuild"),
                log: this.log
            });

            await prebuiltManager.initialize();

            const nodeBinPath = await prebuiltManager.get({
                version
            });

            const packageManager = new kri.PackageManager({
                nodeManager: this.nodejsManager,
                version,
                path: args.get("path"),
                name: opts.get("name"),
                out: opts.get("out"),
                kriConfig,
                nodeBinPath,
                log: this.log
            });

            await packageManager.create();

            this.log({
                message: "done",
                status: true
            });

            return 0;
        } catch (err) {
            this.log({
                message: err.message,
                status: false,
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }
}
