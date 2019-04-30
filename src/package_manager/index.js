import EOFBuilder from "./eof_builder";

const {
    cli: { style },
    is,
    fs,
    realm,
    path,
    stream: { MultiStream },
    task
} = adone;

export default class NodejsPackager extends task.TaskManager {
    constructor(options = {}) {
        super();
        this.log = options.log;
        this.options = options;
        this.kriConfig = options.kriConfig;
    }

    async create() {
        this.log({
            stdout: `KRI version: ${style.primary(kri.package.version)}`
        });

        await this.#initialize();
        await this.#buildEof();
        await this.#profit();
    }

    async #initialize() {
        if (this.options.input === "self") {
            this.options.input = kri.ROOT_PATH;
        }
        this.options.input = path.resolve(this.options.input);

        // this.verbose = Boolean(this.options.verbose);

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
        }

        // load tasks
        await this.loadTasksFrom(path.join(__dirname, "tasks"), {
            transpile: false
        });

        // create temporary build dir
        this.buildPath = path.join(this.inputRealm.getPath("tmp"), "kri_build");
        
        // delete previous build directory
        await fs.remove(this.buildPath);
        await fs.mkdirp(this.buildPath);
    }

    async #buildEof() {
        const eofBuilder = new EOFBuilder();

        const initCode = await this.runAndWait("buildInit")
        eofBuilder.addInit(initCode);

        this.#saveToBuild({
            name: "init.js",
            data: initCode
        });

        this.log({
            message: "preparing volumes"
        });

        const volumes = [
            {
                type: "zip",
                //mapping: "", // ???
                input: this.inputRealm ? this.inputRealm : this.options.input,
                startup: true
            }
        ];

        for (const [name, { input, type, mapping }] of Object.entries(this.kriConfig.raw.volumes)) {
            volumes.push({
                input,
                type,
                mapping,
                startup: false
            });
        }

        await this.#addVolumes(eofBuilder, volumes);

        this.log({
            message: "volumes added",
            status: true
        });

        this.log({
            message: "building eof"
        });

        eofBuilder.build();
        this.eof = eofBuilder;

        await new Promise((resolve, reject) => {
            this.eof.toStream().pipe(fs.createWriteStream(path.join(this.buildPath, "eof")))
                .on("error", reject)
                .on("close", resolve);
        });

        this.log({
            message: "eof successfully builded",
            status: true
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

    async #saveToBuild({ name, data } = {}) {
        const fullPath = path.join(this.buildPath, name);
        await fs.mkdirp(path.dirname(fullPath));
        await fs.writeFile(fullPath, data);
    }

    async #profit() {
        this.log({
            message: "generating package"
        });

        let outName;
        if (is.string(this.options.nane)) {
            outName = this.options.nane;
        } else {
            outName = path.basename(this.options.input, path.extname(this.options.input));
        }

        const outPath = path.resolve(this.options.out, outName);
        await fs.mkdirp(path.dirname(outPath));

        await new Promise((resolve, reject) => {
            const ms = new MultiStream([
                fs.createReadStream(this.options.nodeBinPath),
                this.eof.toStream()
            ])
                .pipe(fs.createWriteStream(path.resolve(this.options.out, outName)))
                .on("error", reject)
                .on("close", resolve);
        });

        const mode = await fs.statSync(this.options.nodeBinPath).mode;
        await fs.chmod(outPath, mode.toString(8).slice(-3));
    }
}
