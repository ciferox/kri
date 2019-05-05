const {
    cli,
    fs,
    app: {
        Subsystem,
        command
    },
} = adone;
const { chalk, style, chalkify } = cli;

export default class ADONECommand extends Subsystem {
    @command({
        name: ["list", "ls"],
        description: "Show ADONE releases"
    })
    list() {
        
    }

    @command({
        name: "spawn",
        description: "Spawn ADONE realm",
        arguments: [
            {
                name: "source",
                type: String,
                default: "",
                description: "Source of packed realm"
            }
        ]
    })
    spawn() {
        
    }
}
