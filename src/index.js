import "adone";

const kri = {
    HOME_PATH: adone.std.path.join(adone.system.env.home(), ".kri")
};

adone.lazify({
    package: "../package.json",
    Configuration: "./configuration",
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
