const {
    cli,
    error,
    fs,
    app: {
        Subsystem,
        command
    },
    path: aPath
} = adone;
const { chalk, style, chalkify } = cli;

const versionRegex = /^v\d+\.\d+\.\d+/;

export default class ADONECommand extends Subsystem {
    onConfigure() {
        this.log = this.root.log;
    }

    @command({
        name: ["list", "ls"],
        description: "Show ADONE releases"
    })
    list() {

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
                name: ["--bin-name", "-B"],
                type: String,
                default: "adone",
                description: "Global executable name of ADONE cli"
            }
        ]
    })
    async spawn(args, opts) {
        const { source, path, dirName } = opts.getAll();

        const destPath = aPath.resolve(path, dirName);

        try {
            if (await fs.pathExists(destPath)) {
                throw new error.ExistsException(`Path '${destPath}' already exists`);
            }

            await fs.mkdirp(destPath);

            if (source === "kri") {
                // extract bundled ADONE realm

                this.log({
                    message: "extracting files from KRI"
                });

                await fs.copyEx("/adone", destPath, {
                    results: false,
                    dot: true,
                    junk: true
                });
            } else if (versionRegex.test(source)) {
                //
            }

            this.log({
                message: "done",
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

            await fs.remove(destPath);
            return 1;
        }
    }
}
