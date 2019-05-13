require(process.argv[2]);

const run = async () => {
    try {
        const targetRealm = new adone.realm.RealmManager({
            cwd: process.argv[3]
        });
        await targetRealm.connect({ transpile: true });
        await targetRealm.runAndWait("build");
        process.exit(0);
    } catch (err) {
        console.log(err.stack);
        process.exit(1);
    }
};

run();
