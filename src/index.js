require("adone");

const kri = {
    ROOT_PATH: adone.std.path.join(__dirname, ".."),
    HOME_PATH: adone.std.path.join(adone.system.env.home(), ".kri")
};

adone.lazify({
    package: "../package.json",
    Configuration: "adone/lib/app/configuration",
    fs: "./fs",
    nodejs: "./nodejs"
}, kri, require);

Object.defineProperty(global, "kri", {
    enumerable: true,
    value: kri
});

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.kri = adone.asNamespace(kri);
