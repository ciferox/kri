const {
    fs,
    task: { IsomorphicTask, task },
    path: { join }
} = adone;

@task("buildLoader")
export default class extends IsomorphicTask {
    async main({ cwd, path } = {}) {
        this.manager.log && this.manager.log({
            message: "building 'loader'"
        });

        await fs.writeFile(join(cwd, "lib/_third_party_main"), await fs.readFile(path, "utf8"), "utf8");

        this.manager.log && this.manager.log({
            message: "'loader' successfully builded",
            status: true
        });
    }
}
