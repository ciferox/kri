const {
    is,
    path: aPath
} = adone;

export default class KRIConfiguration extends adone.configuration.GenericConfig {
    static async load({ cwd, path } = {}) {
        if (is.string(path)) {
            cwd = aPath.dirname(path);
            path = aPath.basename(path);
        } else {
            path = KRIConfiguration.configName;
        }

        const config = new KRIConfiguration({
            cwd
        });

        await config.load(path, {
            transpile: true
        });
        return config;
    }

    static configName = ".adone/kri";
}
