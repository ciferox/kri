const {
    fs,
    std: { path: { join } }
} = adone;
const {
    nodejs: { EOFBuilder }
} = kri;

export const volumePath = (...args) => join(__dirname, "volumes", ...args);

const DEFAULT_INIT = Buffer.alloc(12);
export const getSimpleBuilder = async ({ init = DEFAULT_INIT, name = "app", type = "zip", mapping, index = "index.js" } = {}) => {
    const eofBuilder = new EOFBuilder();
    const volume = volumePath("app.zip");

    eofBuilder.addInit(init);

    await eofBuilder.addVolume({
        type,
        mapping,
        name,
        volume,
        startup: true,
        index
    });
    eofBuilder.build();

    return eofBuilder;
};

export const writeExecFile = (execPath, eofBuilder) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(execPath);
    eofBuilder.toStream()
        .pipe(ws)
        .on("close", resolve)
        .on("error", reject);
});