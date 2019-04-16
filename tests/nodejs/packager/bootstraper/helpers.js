const {
    std: { path: { join } }
} = adone;
const {
    nodejs: { EOFBuilder }
} = kri;

export const volumePath = (...args) => join(__dirname, "volumes", ...args);

export const getSimpleBuilder = async () => {
    const eofBuilder = new EOFBuilder();
    const name = "app";
    const index = "index.js";
    const volume = volumePath("app.zip");
    await eofBuilder.addVolume({
        name,
        volume,
        startup: true,
        index
    });
    eofBuilder.build();

    return eofBuilder;
};
