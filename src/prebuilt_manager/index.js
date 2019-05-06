import StatusFile from "./status_file";

const {
    is,
    cli: { style },
    fs,
    nodejs,
    path,
    task,
    util
} = adone;


const DEFAULT_CONFIGURE_FLAGS = [
    `--dest-cpu=${process.arch}`
];

const DEFAULT_MAKE_FLAGS = ["-j8"];

const NODE_BIN_PATH = path.join("out", "Release", "node");

const normalizeArgs = (args) => {
    if (is.set(args)) {
        return [...args.values()];
    } else if (is.string(args)) {
        return args.split(";");
    }

    return util.arrify(args);
}

const useFlags = (defaults, ...customs) => {
    const result = new Set(normalizeArgs(defaults));
    for (const flags of customs) {
        for (const f of normalizeArgs(flags)) {
            result.add(f);
        }
    }

    return [...result.values()];
};

const getPrebuiltPath = async (version) => kri.getPath("var", "prebuilts", await nodejs.getArchiveName({ version, ext: "" }));
const getPrebuiltUrl = async (version, loaderVersion, eofVersion) => `https://github.com/ciferox/kri/releases/download/v${loaderVersion}.${eofVersion}/${await nodejs.getArchiveName({ version, ext: "" })}`;

export default class PrebuiltManager extends task.TaskManager {
    constructor({ nodeManager, kriConfig, log, forceConfigure, forceBuild } = {}) {
        super();
        this.nodeManager = nodeManager;
        this.kriConfig = kriConfig;
        this.forceConfigure = forceConfigure;
        this.forceBuild = forceBuild;
        this.log = log;
    }

    async initialize() {
        // load tasks
        await this.loadTasksFrom(path.join(__dirname, "tasks"), {
            transpile: false
        });
    }

    async get({ version, fresh = false } = {}) {
        this.version = version;
        this.fresh = fresh;

        const prebuiltPath = await getPrebuiltPath(version);
        if (!fresh && !this.forceConfigure && !this.forceBuild) {
            if (await fs.isExecutable(prebuiltPath, { ignoreErrors: true })) {
                return prebuiltPath;
            }

            this.log && this.log({
                message: `downloading prebuilt Node.js ${style.primary(version)}`
            })

            const prebuiltUrl = await getPrebuiltUrl(version, kri.package.versions.loader, kri.package.versions.eof);
            const downloader = new adone.http.Downloader({
                url: prebuiltUrl,
                dest: prebuiltPath
            });

            try {
                await downloader.download();
                await adone.promise.delay(500);

                this.log && this.log({
                    message: `prebuilt Node.js ${style.primary(version)} successfully downloaded`,
                    status: true
                });

                return prebuiltPath;
            } catch (err) {
                //
            }
        }

        await this.#prepareNodejsSources();
        await this.#patchNodejsSources();
        await this.#buildNodejs();

        await fs.mkdirp(path.dirname(prebuiltPath));
        await fs.copyFile(path.join(this.nodejsBasePath, NODE_BIN_PATH), prebuiltPath);

        return prebuiltPath;
    }

    async #prepareNodejsSources() {
        const version = this.version;
        const fresh = this.fresh;
        const type = "sources";

        let sourcesPath = await this.nodeManager.getCachePathFor(this.nodeManager.cache.sources, { version, type, ext: "" });
        if (fresh) {
            this.log && this.log({
                message: `deleting old files ${style.focus("(--fresh mode)")}`
            })
            await fs.remove(sourcesPath);
            this.log && this.log({
                message: `old files deleted ${style.focus("(--fresh mode)")}`,
                status: true
            })
        }
        if (!(await fs.pathExists(sourcesPath))) {
            sourcesPath = await this.nodeManager.getCachePathFor(this.nodeManager.cache.downloads, { version, type });
            if (fresh) {
                await fs.remove(sourcesPath);
            }
            if (!(await fs.pathExists(sourcesPath))) {
                this.log && this.log({
                    message: `downloading Node.js ${style.primary(version)}`
                });

                await this.nodeManager.download({
                    version,
                    type,
                    progressBar: true
                });

                this.log && this.log({
                    message: `Node.js ${style.primary(version)} sources successfully downloaded`,
                    status: true
                });
            }

            this.log && this.log({
                message: "extracting Node.js sources"
            });
            sourcesPath = await this.nodeManager.extract({
                version,
                type
            });
            this.log && this.log({
                message: "Node.js sources successfully extracted",
                status: true
            });
        }

        this.privatePath = path.join(sourcesPath, ".kri");
        this.backupPath = path.join(this.privatePath, "backup");
        await fs.mkdirp(this.privatePath);

        this.statusfile = new StatusFile({
            cwd: this.privatePath
        });

        await this.statusfile.update();

        this.nodejsBasePath = sourcesPath;
    }

    async #patchNodejsSources() {
        this.log && this.log({
            message: "patching Node.js sources"
        });

        await this.runAndWait("patchFile", {
            files: "src/node.cc",
            from: /(?<!int ) = ProcessGlobalArgs\(/g,
            to: " = 0;//ProcessGlobalArgs("
        });

        await this.runAndWait("patchFile", {
            files: "node.gyp",
            from: "    'library_files': [",
            to: [
                "    'library_files': [",
                "      'lib/_third_party_main',"
            ].join("\n"),
            once: true
        });

        await this.runAndWait("patchFile", {
            files: "lib/internal/bootstrap/node.js",
            from: "process._exiting = false;",
            to: [
                "process._exiting = false;",
                "",
                await fs.readFile(path.join(kri.cwd, "lib", "assets", "bootstrap.js"), "utf8")
            ].join("\n"),
            once: true
        });

        await this.runAndWait("buildLoader", {
            cwd: this.nodejsBasePath,
            path: path.join(kri.cwd, "lib", "assets", "loader.js")
        });

        this.log && this.log({
            message: "Node.js sources successfully patched",
            status: true
        });
    }

    async #buildNodejs() {
        const compiler = new nodejs.NodejsCompiler({
            cwd: this.nodejsBasePath
        });

        let reconfigured = false;
        const newConfigureArgs = useFlags(DEFAULT_CONFIGURE_FLAGS, this.kriConfig.raw.configure);
        this.log && this.log({
            stdout: `Node.js configure flags: ${style.accent(newConfigureArgs.join(" "))}`
        });

        this.log && this.log({
            message: "configuring Node.js build system"
        });

        if (this.forceConfigure || !is.deepEqual(this.statusfile.get("configure"), newConfigureArgs)) {
            const configureResult = await compiler.configure({
                flags: newConfigureArgs
            });

            if (configureResult.code !== 0) {
                this.log && this.log({
                    stderr: configureResult.stderr
                });
                return;
            }

            await this.statusfile.update({
                configure: newConfigureArgs
            });
            reconfigured = true;
        }

        this.log && this.log({
            message: "Node.js build system successfully configured",
            status: true
        });

        if (this.forceBuild || reconfigured || !(await fs.pathExists(path.join(this.nodejsBasePath, NODE_BIN_PATH)))) {
            const newMakeArgs = useFlags(DEFAULT_MAKE_FLAGS, this.kriConfig.raw.make);
            this.log && this.log({
                stdout: `Node.js make flags: ${style.accent(newMakeArgs.join(" "))}`
            });

            this.log && this.log({
                message: "building Node.js"
            });

            const buildResult = await compiler.build(newMakeArgs);

            if (buildResult.code !== 0) {
                this.log && this.log({
                    stderr: buildResult.stderr
                });
                return;
            }

            await this.statusfile.update({
                make: newMakeArgs
            });

            this.log && this.log({
                message: "Node.js successfully builded",
                status: true
            });
        }
    }
}
