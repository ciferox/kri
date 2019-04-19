const {
    fs,
    std: { path: { join }, fs: nfs },
    text: { random: rndName }
} = adone;

const {
    fs: kriFs
} = kri;

describe("fs", "backend", "MountableFS", () => {
    let nativeFs;

    before(() => {
        nativeFs = kriFs.backend.native.create({ fs: adone.std.fs });
        kriFs.initialize(nativeFs);
    });

    describe("NativeFS", () => {
        it("mount as normal", () => {
            const mntFs = kriFs.backend.mountable.create({});
            mntFs.mount("/nativefs", nativeFs);
            kriFs.initialize(mntFs);

            const fname = rndName(8);

            assert.isFalse(fs.existsSync(`/tmp/${fname}`));
            mntFs.mkdirSync(`/nativefs/tmp/${fname}`);
            assert.isTrue(fs.existsSync(`/tmp/${fname}`));
            nfs.rmdirSync(`/tmp/${fname}`);

            assert.sameMembers(mntFs.readdirSync("/nativefs"), nfs.readdirSync("/"));
        });

        it("mount as root", () => {
            const mntFs = kriFs.backend.mountable.create({});
            mntFs.mount("/", nativeFs);
            kriFs.initialize(mntFs);

            const fname = rndName(8);

            assert.isFalse(fs.existsSync(`/tmp/${fname}`));
            mntFs.mkdirSync(`/tmp/${fname}`);
            assert.isTrue(fs.existsSync(`/tmp/${fname}`));
            nfs.rmdirSync(`/tmp/${fname}`);

            assert.sameMembers(mntFs.readdirSync("/"), nfs.readdirSync("/"));
        });
    });
});

