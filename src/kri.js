#!/usr/bin/env node

import "..";

const {
    is,
    path,
    app
} = adone;

const {
    subsystem
} = app;

const command = (...args) => path.join(__dirname, "..", "lib", "commands", ...args);

@subsystem({
    subsystems: [
        {
            name: "inspect",
            group: "common",
            description: "Inspect namespace/object",
            subsystem: command("inspect")
        },
        {
            name: "node",
            group: "common",
            description: "Node.js toolkit",
            subsystem: command("node")
        },
        {
            name: ["package", "pkg"],
            group: "common",
            description: "Manage executable packages",
            subsystem: command("package")
        },
        {
            name: "realm",
            group: "common",
            description: "Realm management",
            subsystem: command("realm")
        },
        {
            name: "repl",
            group: "common",
            description: "Async REPL",
            subsystem: command("repl")
        },
        {
            name: "run",
            group: "common",
            description: "Run application/script/code",
            subsystem: command("run")
        }
    ]
})
class KRI extends app.Application {
    async onConfigure() {
        if (typeof global.__kri__ !== "undefined") {
            // override requireAddon
            const init = global.__kri__.initSubsystem;
            // force call
            adone.module.requireAddon("#");
            adone.requireAddon("#");

            adone.module.requireAddon = adone.requireAddon = (addonPath) => {
                if (!path.isAbsolute(addonPath)) {
                    throw Error("Path to addon should be absolute");
                }
                if (init.isVirtual(addonPath)) {
                    const addonName = `${adone.std.crypto.createHash("sha1").update(`${addonPath}${kri.package.version}`).digest("hex")}.node`;
                    const realPath = path.join(kri.HOME_PATH, "addons", addonName);
                    try {
                        return require(realPath);
                    } catch (err) {
                        adone.fs.mkdirpSync(path.dirname(realPath));
                        adone.fs.copyFileSync(addonPath, realPath);
                        return require(realPath);
                    }
                }

                return require(addonPath);
            };
        }

        !is.windows && this.exitOnSignal("SIGINT");

        this.config = await kri.Configuration.load({
            cwd: kri.realm.getPath("etc")
        });

        // Define command groups.
        const groups = this.config.getGroups();
        for (const group of groups) {
            this.helper.defineCommandsGroup(group);
        }

        await this._addInstalledSubsystems();
    }

    async run() {
        // print usage message by default
        console.log(`${this.helper.getHelpMessage()}\n`);
        return 0;
    }

    async _addInstalledSubsystems() {
        const commands = this.config.getCommands();
        for (const ss of commands) {
            // eslint-disable-next-line
            await this.helper.defineCommandFromSubsystem({
                ...adone.util.omit(ss, "name"),
                name: [ss.name, ...adone.util.arrify(ss.aliases)],
                lazily: true
            });
        }
    }
}

app.run(KRI, {
    useArgs: true,
    version: `KRI: v${kri.package.version}
ADONE: v${adone.package.version}
Node.js: ${process.version}
V8: v${process.versions.v8}
uv: v${process.versions.uv}`
});
