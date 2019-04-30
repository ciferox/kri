const {
    app: {
        Subsystem,
        subsystem
    }
} = adone;


const subCommand = (...args) => adone.path.join(__dirname, "commands", ...args);

@subsystem({
    subsystems: [
        {
            name: "create",
            description: "Create package",
            subsystem: subCommand("create")
        },
        {
            name: "publish",
            description: "Publish prebuilt to GitHub",
            subsystem: subCommand("publish")
        }
    ]
})
export default class PackageCommand extends Subsystem {
}
