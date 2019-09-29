require("adone");

const kri = {
    cwd: adone.path.join(__dirname, ".."),
    getPath: (...args) => adone.path.join(kri.cwd, ...args),
    HOME_PATH: adone.path.join(adone.system.env.home(), ".kri")
};

adone.lazify({
    package: "../package.json",
    Configuration: "adone/lib/app/configuration",
    KRIConfiguration: "./kri_configuration",
    PrebuiltManager: "./prebuilt_manager",
    PackageManager: "./package_manager",
    weres: "./weres",
    realm: () => new adone.realm.RealmManager({ cwd: kri.cwd })
}, kri, require);

Object.defineProperty(global, "kri", {
    enumerable: true,
    value: kri
});

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.kri = adone.asNamespace(kri);
