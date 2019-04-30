const {
    fs: { replaceInFile, pathExists },
    task: { IsomorphicTask, task },
    path: { join }
} = adone;

@task("patchFile")
export default class extends IsomorphicTask {
    async main(options) {
        if (options.once && await pathExists(join(this.manager.backupPath, options.files))) {
            return;
        }

        await replaceInFile({
            ...options,
            disableGlobs: true,
            cwd: this.manager.nodejsBasePath,
            backupPath: this.manager.backupPath
        });
    }
}
