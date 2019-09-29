/* eslint-disable func-style */
const {
    system: { info: si },
    std: { path, os }
} = adone;

const { weres } = kri;

async function systeminfo() {
    const info = {};
    await Promise.all([
        si.battery().then((r) => info.battery = r),
        si.cpu().then((r) => info.cpu = r),
        si.osInfo().then((r) => info.osInfo = r)
    ]);
    return info;
}

const {
    app: { Subsystem, mainCommand }
} = adone;

export default class SelfCommand extends Subsystem {
    @mainCommand({
    })
    async main() {
        let app;
        try {
            app = await weres.launch({
                bgcolor: "#2b2e3b",
                title: "Systeminfo App",
                width: 1000,
                height: 500,
                channel: ["canary", "stable"],
                icon: path.join(__dirname, "assets/app_icon.png"),
                args: process.env.DEV === "true" ? ["--auto-open-devtools-for-tabs"] : [],
                localDataDir: path.join(os.homedir(), ".carlosysteminfo")
            });
        } catch (e) {
            console.log(e);
            // New window is opened in the running instance.
            console.log("Reusing the running instance");
            return;
        }
        app.on("exit", () => process.exit());
        // New windows are opened when this app is started again from command line.
        app.on("window", (window) => window.load("index.html"));
        app.serveFolder(path.join(__dirname, "www"));
        await app.exposeFunction("systeminfo", systeminfo);
        await app.load("index.html");
    }
}
