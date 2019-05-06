import EOFBuilder from "./eof_builder";

const {
    cli: { style },
    is,
    fs,
    realm,
    path,
    stream: { MultiStream },
    task,
    util
} = adone;

export default class PackageManager extends task.TaskManager {
    constructor(options = {}) {
        super();
        this.log = options.log;
        this.options = options;
        this.kriConfig = options.kriConfig;
    }

    async create() {
        this.log && this.log({
            stdout: `KRI version: ${style.primary(kri.package.version)}`
        });

        await this.#initialize();
        await this.#buildEof();
        await this.#profit();
    }

    async #initialize() {
        // Connecting to root realm.
        await realm.rootRealm.connect();

        this.options.path = path.resolve(this.options.path);
    
        const { path: realmPath } = this.options;

        this.inputRealm = new realm.RealmManager({
            cwd: realmPath
        });
        await this.inputRealm.connect();

        // load tasks
        await this.loadTasksFrom(path.join(__dirname, "tasks"), {
            transpile: false
        });

        // create temporary build dir
        this.buildPath = path.join(this.inputRealm.getPath("tmp"), "kri_build");
        
        // delete previous build directory
        await fs.remove(this.buildPath);
        await fs.mkdirp(this.buildPath);

        let basePath = path.join(
                await this.options.nodeManager.getCachePath(this.options.nodeManager.cache.release),
                await adone.nodejs.getArchiveName({ version: this.options.version, ext: "" })
        );

        if (!(await fs.pathExists(basePath))) {
            // download realease for building target realms
            await this.options.nodeManager.download({
                version: this.options.version
            });
            basePath = await this.options.nodeManager.extract({
                version: this.options.version
            });
        }
        this.nodeRelPath = path.join(basePath, "bin", "node");
    }

    async #buildEof() {
        const eofBuilder = new EOFBuilder();

        const initCode = await this.runAndWait("buildInit")
        eofBuilder.addInit(initCode);
        eofBuilder.addData(Buffer.from(JSON.stringify(util.pick(this.kriConfig.raw, [
            "fs"
        ]))));

        this.#saveToBuild({
            name: "init.js",
            data: initCode
        });

        this.log && this.log({
            message: "preparing volumes"
        });

        const volumes = [];

        for (const [name, { input, type, mapping, startup }] of Object.entries(this.kriConfig.raw.volumes)) {
            volumes.push({
                input,
                type,
                mapping,
                startup: Boolean(startup)
            });
        }

        await this.#addVolumes(eofBuilder, volumes);

        this.log && this.log({
            message: "volumes added",
            status: true
        });

        this.log && this.log({
            message: "building eof"
        });

        eofBuilder.build();
        this.eof = eofBuilder;

        await new Promise((resolve, reject) => {
            this.eof.toStream().pipe(fs.createWriteStream(path.join(this.buildPath, "eof")))
                .on("error", reject)
                .on("close", resolve);
        });

        this.log && this.log({
            message: "eof successfully builded",
            status: true
        });
    }

    async #addVolumes(eofBuilder, volumes) {
        for (const { input, type, mapping, startup } of volumes) {
            const { name, filename, volume, index } = await this.runAndWait("volumeCreate", {
                input,
                startup,
                nodePath: this.nodeRelPath,
                version: this.options.version
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
        this.log && this.log({
            message: "generating package"
        });

        let outName;
        if (is.string(this.options.name) && this.options.name.length > 0) {
            outName = this.options.name;
        } else {
            outName = path.basename(this.options.path);
        }

        const outPath = path.resolve(this.options.out, outName);
        await fs.mkdirp(this.options.out);

        await new Promise((resolve, reject) => {
            const ms = new MultiStream([
                fs.createReadStream(this.options.nodeBinPath),
                this.eof.toStream()
            ])
                .pipe(fs.createWriteStream(outPath))
                .on("error", reject)
                .on("close", resolve);
        });

        const mode = await fs.statSync(this.options.nodeBinPath).mode;
        await fs.chmod(outPath, mode.toString(8).slice(-3));
    }
}
PackageManager.EOFBuilder = EOFBuilder;
