import StatusFile from "./status_file";

const {
    is,
    fs,
    std: { path },
    task,
    util
} = adone;

const {
    nodejs
} = kri;
const { NodejsManager, NodejsCompiler } = nodejs;

const DEFAULT_CONFIGURE_FLAGS = new Set([
    `--dest-cpu=${process.arch}`,
    "--fully-static",
    "--without-node-options",
    "--without-npm",
    "--without-inspector",
    "--experimental-http-parser",
    //"--release-urlbase="
    ...(is.linux ? ["--enable-lto"] : [])
]);

const NODE_BIN_PATH = path.join("out", "Release", "node");

const normalizeArgs = (args) => {
    if (is.set(args)) {
        return [...args.values()];
    } else if (is.string(args)) {
        return args.split(";");
    }

    return util.arrify(args);
}

const useFlags = (defaults, customs) => {
    const result = new Set(normalizeArgs(defaults));
    for (const f of normalizeArgs(customs)) {
        result.add(f);
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
    }

    async create() {
        this.cwd = await this.#prepareSources();

        await this.loadTasksFrom(path.join(__dirname, "tasks"), {
            transpile: false
        });

        // Patch some files
        await this.#patchFile({
            files: "src/node.cc",
            from: /(?<!int ) = ProcessGlobalArgs\(/g,
            to: " = 0;//ProcessGlobalArgs("
        });

        await this.#patchFile({
            files: "node.gyp",
            from: "    'library_files': [",
            to: [
                "    'library_files': [",
                "      'lib/_third_party_main',"
            ].join("\n"),
            once: true
        });

        // Prepare _third_party_main
        let _third_party_main;
        if (is.string(this.options.easy)) {
            _third_party_main = await fs.readFile(path.resolve(this.options.easy), { encoding: "utf8" });
        } else {
            // default
            _third_party_main = await this.runAndWait("generateLoader", {
                cwd: this.cwd
            });
        }

        await this.#writeFile({
            file: "lib/_third_party_main",
            content: _third_party_main
        });

        const compiler = new NodejsCompiler({
            cwd: this.cwd
        });

        this.log({
            message: "configuring build system"
        });

        let reconfigured = false;
        const newConfigureArgs = useFlags(DEFAULT_CONFIGURE_FLAGS, this.options.configure);
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

        if (this.options.forceBuild || reconfigured || !(await fs.exists(path.join(this.cwd, NODE_BIN_PATH)))) {
            this.log({
                message: "building Node.js"
            });

            const newMakeArgs = useFlags([], this.options.make);
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
        }
    }

    #writeFile({ file, content, encoding = "utf8" } = {}) {
        return fs.writeFile(path.join(this.cwd, file), content, encoding);
    }

    #patchFile(options) {
        return this.runAndWait("patchFile", {
            ...options,
            cwd: this.cwd,
            backupPath: this.backupPath
        });
    }

    async #prepareSources() {
        this.log({
            message: "checking version"
        });

        const version = await nodejs.checkVersion(this.version);
        const type = "sources";

        let sourcesPath = await this.manager.getCachePathFor(this.manager.cache.sources, { version, type, ext: "" });
        if (this.options.fresh) {
            await fs.rm(sourcesPath);
        }
        if (!(await fs.exists(sourcesPath))) {
            sourcesPath = await this.manager.getCachePathFor(this.manager.cache.download, { version, type });
            if (this.options.fresh) {
                await fs.rm(sourcesPath);
            }
            if (!(await fs.exists(sourcesPath))) {
                this.log({
                    message: "waiting"
                });

                await this.manager.download({
                    version,
                    type,
                    progressBar: true
                });
            }

            this.log({
                message: "extracting sources"
            });
            sourcesPath = await this.manager.extract({
                version,
                type
            });
        }

        this.privatePath = path.join(sourcesPath, ".kri");
        this.backupPath = path.join(this.privatePath, "backup");
        await fs.mkdirp(this.privatePath);

        this.statusfile = new StatusFile({
            cwd: this.privatePath
        });

        await this.statusfile.update();

        return sourcesPath;
    }
}
