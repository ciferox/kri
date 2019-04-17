const {
    fs: { replaceInFile, exists, readFile },
    task: { IsomorphicTask, task },
    std: { path: { join } },
    util: { arrify }
} = adone;

@task("patchFile")
export default class PatchFile extends IsomorphicTask {
    async main(options) {
        if (options.once && await exists(join(this.manager.backupPath, options.files))) {
            return;
        }

        await replaceInFile({
            ...options,
            disableGlobs: true,
            cwd: this.manager.cwd,
            backupPath: this.manager.backupPath
        });
    }
}
