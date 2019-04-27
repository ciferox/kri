const {
    is,
    fs,
    task: { IsomorphicTask, task },
    std: { path: { join, resolve } }
} = adone;

@task("buildLoader")
export default class extends IsomorphicTask {
    async main({ cwd, path, options } = {}) {
        this.manager.log({
            message: "building 'loader'"
        });

        // Prepare _third_party_main
        let _third_party_main;
        if (is.string(options.easy)) {
            _third_party_main = await fs.readFile(resolve(options.easy), { encoding: "utf8" });
        } else {
            // default            
            _third_party_main = await fs.readFile(path, "utf8");
        }

        await fs.writeFile(join(cwd, "lib/_third_party_main"), _third_party_main, "utf8");

        this.manager.log({
            message: "'loader' successfully builded",
            status: true
        });
    }
}
