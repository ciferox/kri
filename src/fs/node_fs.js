/* eslint-disable adone/no-typeof */
import FS from "./fs";
// Manually export the individual public functions of fs.
// Required because some code will invoke functions off of the module.
// e.g.:
// let writeFile = fs.writeFile;
// writeFile(...)
/**
 * @hidden
 */
let fs = new FS();

const _fsMock = {};
Object.getOwnPropertyNames(FS.prototype).forEach((key) => {
    if (typeof fs[key] === "function") {
        _fsMock[key] = function () {
            return fs[key].apply(fs, arguments);
        };
    } else {
        _fsMock[key] = fs[key];
    }
});
_fsMock.changeFSModule = function (newFs) {
    fs = newFs;
};
_fsMock.getFSModule = function () {
    return fs;
};
_fsMock.FS = FS;
_fsMock.Stats = FS.Stats;
export default _fsMock;
