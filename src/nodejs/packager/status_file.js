const {
    is
} = adone;

const STATUSFILE = "status.json";

export default class StatusFile extends adone.configuration.GenericConfig {
    async update(config) {
        try {
            await this.load(STATUSFILE);
        } catch (err) {
            await this.save(STATUSFILE);
        }

        if (is.plainObject(config)) {
            this.assign(config);
            await this.save(STATUSFILE, {
                space: "    "
            });
        }
    }
}
