const {
    app: { Subsystem, command }
} = adone;

export default class SelfCommand extends Subsystem {
    @command({
        name: ["install", "i"],
        description: "Install KRI in system"
    })
    install() {

    }

    @command({
        name: ["uninstall", "u"],
        description: "Uninstall KRI from system"
    })
    uninstall() {

    }

    @command({
        name: ["upgrade", "up"],
        description: "Upgrade KRI to latest version"
    })
    upgrade() {

    }
}
