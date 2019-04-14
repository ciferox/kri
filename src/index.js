import "adone";

const kri = adone.lazify({
    package: "../package.json",
    Configuration: "./configuration",
    fs: "./fs"
}, null, require);

Object.defineProperty(global, "kri", {
    enumerable: true,
    value: kri
});

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.kri = adone.asNamespace(kri);
