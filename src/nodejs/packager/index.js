import StatusFile from "./status_file";
import EOFBuilder from "./eof_builder";

const {
    cli: { chalk, style },
    error,
    is,
    fast,
    fs,
    realm,
    std: { path },
    stream: { MultiStream },
    task,
    util
} = adone;

const {
    nodejs
} = kri;
const { NodejsManager, NodejsCompiler } = nodejs;

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



export default class NodejsPackager extends task.TaskManager {
    constructor(options = {}) {
        super();
        this.version = options.version;
        this.log = options.log;
        this.manager = options.manager || new NodejsManager();
        this.options = options;
        this.kriConfig = {};
    }

    async create() {
        this.log({
            stdout: `KRI version: ${style.primary(kri.package.version)}`
        });

        // 0.
        await this.#checkNodejsVersion();

        // 1.
        await this.#initialize();

        // 2.
        await this.#prepareSources();

        // 3.
        await this.#patchFiles();

        // 4.
        await this.runAndWait("buildLoader", {
            cwd: this.cwd,
            path: path.join(__dirname, "assets", "loader.js"),
            options: this.options
        });

        // 5.
        await this.#configureAndBuildSources();

        // 6.
        await this.#buildEof();

        // 7.
        await this.#profit();
    }

    async #initialize() {
        if (this.options.easy && this.options.input === "self") {
            throw new error.NotAllowedException("Self-packaging is not allowed in easy mode");
        }

        if (this.options.input === "self") {
            this.options.input = kri.ROOT_PATH;
        }
        this.options.input = path.resolve(this.options.input);

        this.verbose = Boolean(this.options.verbose);

        const { input } = this.options;

        const lstat = await fs.lstat(input);
        if (lstat.isDirectory()) {
            // Connecting to root realm.
            await realm.rootRealm.connect();

            // Check realm
            this.inputRealm = new realm.RealmManager({
                cwd: input
            });

            await this.inputRealm.connect();

            try {
                this.kriConfig = adone.require(this.inputRealm.getPath(".adone", "kri"));
                if (this.kriConfig.default) {
                    this.kriConfig = this.kriConfig.default;
                }
            } catch (err) {
                //
            }
        }

        // Load custom config instead of default (in case of realm).
        if (is.string(this.options.config)) {
            this.kriConfig = adone.require(path.resolve(this.options.config));
        }

        // load tasks
        await this.loadTasksFrom(path.join(__dirname, "tasks"), {
            transpile: false
        });
    }

    async #checkNodejsVersion() {
        this.log({
            message: "checking version"
        });
        this.version = await nodejs.checkVersion(this.version);

        // TODO: Check minimum supported version

        this.log({
            stdout: `Node.js version: ${style.primary(this.version)}`,
            status: true,
            clean: true
        });
    }

    async #prepareSources() {
        const version = this.version;
        const type = "sources";

        let sourcesPath = await this.manager.getCachePathFor(this.manager.cache.sources, { version, type, ext: "" });
        if (this.options.fresh) {
            this.log({
                message: `deleting old files ${style.focus("(--fresh mode)")}`
            })
            await fs.rm(sourcesPath);
            this.log({
                message: `old files deleted ${style.focus("(--fresh mode)")}`,
                status: true
            })
        }
        if (!(await fs.exists(sourcesPath))) {
            sourcesPath = await this.manager.getCachePathFor(this.manager.cache.download, { version, type });
            if (this.options.fresh) {
                await fs.rm(sourcesPath);
            }
            if (!(await fs.exists(sourcesPath))) {
                this.log({
                    message: `downloading Node.js ${style.primary(this.version)}`
                });

                await this.manager.download({
                    version,
                    type,
                    progressBar: true
                });

                this.log({
                    message: `Node.js ${style.primary(this.version)} sources successfully downloaded`,
                    status: true
                });
            }

            this.log({
                message: "extracting Node.js sources"
            });
            sourcesPath = await this.manager.extract({
                version,
                type
            });
            this.log({
                message: "Node.js sources successfully extracted",
                status: true
            });
        }

        this.privatePath = path.join(sourcesPath, ".kri");
        this.backupPath = path.join(this.privatePath, "backup");
        this.buildPath = path.join(this.privatePath, "build");
        await fs.mkdirp(this.privatePath);

        // delete previous build directory
        await fs.rm(this.buildPath);

        this.statusfile = new StatusFile({
            cwd: this.privatePath
        });

        await this.statusfile.update();

        this.cwd = sourcesPath;
    }

    async #patchFiles() {
        this.log({
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
                await fs.readFile(path.join(__dirname, "assets", "bootstrap.js"), "utf8")
            ].join("\n"),
            once: true
        });

        this.log({
            message: "Node.js sources successfully patched",
            status: true
        });
    }

    async #configureAndBuildSources() {
        const compiler = new NodejsCompiler({
            cwd: this.cwd
        });

        let reconfigured = false;
        const newConfigureArgs = useFlags(DEFAULT_CONFIGURE_FLAGS, this.kriConfig.configure, this.options.configure);
        this.verbose && this.log({
            stdout: `Node.js configure flags: ${style.accent(newConfigureArgs.join(" "))}`
        });

        this.log({
            message: "configuring Node.js build system"
        });

        if (this.options.forceConfigure || !is.deepEqual(this.statusfile.get("configure"), newConfigureArgs)) {
            const configureResult = await compiler.configure({
                flags: newConfigureArgs
            });

            if (configureResult.code !== 0) {
                this.log({
                    stderr: configureResult.stderr
                });
                return;
            }

            await this.statusfile.update({
                configure: newConfigureArgs
            });
            reconfigured = true;
        }

        this.log({
            message: "Node.js build system successfully configured",
            status: true
        });

        if (this.options.forceBuild || reconfigured || !(await fs.exists(path.join(this.cwd, NODE_BIN_PATH)))) {
            const newMakeArgs = useFlags(DEFAULT_MAKE_FLAGS, this.kriConfig.make, this.options.make);
            this.verbose && this.log({
                stdout: `Node.js make flags: ${style.accent(newMakeArgs.join(" "))}`
            });

            this.log({
                message: "building Node.js"
            });

            const buildResult = await compiler.build(newMakeArgs);

            if (buildResult.code !== 0) {
                this.log({
                    stderr: buildResult.stderr
                });
                return;
            }

            await this.statusfile.update({
                make: newMakeArgs
            });

            this.log({
                message: "Node.js successfully builded",
                status: true
            });
        }
    }

    async #buildEof() {
        const eofBuilder = new EOFBuilder();

        const initCode = await this.runAndWait("buildInit", {
            cwd: this.cwd,
            path: path.join(__dirname, "assets", "init.js"),
            options: this.options
        })
        eofBuilder.addInit(initCode);

        this.#saveToBuild({
            name: "init.js",
            data: initCode
        });

        const volumes = [
            {
                type: "zip",
                //mapping: "", // ???
                input: this.inputRealm ? this.inputRealm : this.options.input,
                startup: true
            }
        ]

        for (const [name, { input, type, mapping }] of Object.entries(this.kriConfig.volumes)) {
            volumes.push({
                input,
                type,
                mapping,
                startup: false
            });
        }

        await this.#addVolumes(eofBuilder, volumes);

        eofBuilder.build();
        this.eof = eofBuilder;

        await new Promise((resolve, reject) => {
            this.eof.toStream().pipe(fs.createWriteStream(path.join(this.buildPath, "eof")))
                .on("error", reject)
                .on("close", resolve);
        });
    }

    async #addVolumes(eofBuilder, volumes) {
        for (const { input, type, mapping, startup } of volumes) {
            const { name, filename, volume, index } = await this.runAndWait("volumeCreate", {
                input,
                startup
            });
    
            await eofBuilder.addVolume({
                type, 
                name,
                mapping,
                volume,
                index,
                startup
            });

            await this.#saveToBuild({
                name: filename,
                data: volume
            });
        }
    }

    async #saveToBuild({ name, data  } = {}) {
        const fullPath = path.join(this.buildPath, name);
        await fs.mkdirp(path.dirname(fullPath));
        await fs.writeFile(fullPath, data);
    }

    async #profit() {
        let outName;
        if (is.string(this.options.nane)) {
            outName = this.options.nane;
        } else {
            outName = path.basename(this.options.input, path.extname(this.options.input));
        }

        const nodeBinPath = path.join(this.cwd, "out", "Release", "node");
        const outPath = path.resolve(this.options.out, outName);
        await fs.mkdirp(path.dirname(outPath));

        await new Promise((resolve, reject) => {
            const ms = new MultiStream([
                fs.createReadStream(nodeBinPath),
                this.eof.toStream()
            ])
                .pipe(fs.createWriteStream(path.resolve(this.options.out, outName)))
                .on("error", reject)
                .on("close", resolve);
        });

        const mode = await fs.statSync(nodeBinPath).mode;
        await fs.chmod(outPath, mode.toString(8).slice(-3));
    }
}
