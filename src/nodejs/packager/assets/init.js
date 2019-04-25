import StdFileSystem from "./std_fs";
// import MemoryFileSystem from "./memory_fs";
import ZipFileSystem from "./zip_fs";
import path from "../../path";
import nfs from "fs";

// 1. Mount volumes
const stdFs = new StdFileSystem();
const volumes = __kri__.volumes;
for (const volume of volumes.values()) {
    let fs;
    switch (volume.type) {
        case "zip":
            fs = new ZipFileSystem({
                data: volume.data
            });
            break;
        default:
            throw new Error(`Unknown type of file system: ${volume.fs}`);
    }

    stdFs.mount(fs, volume.name);
}

// 2. Patch all needed
const nfsBackup = {};

const { internalPatches: patches } = __kri__;

// TODO: need reimplement
const volumePathPrefixes = [...__kri__.volumes.keys()];
const isVirtual = (filename) => volumePathPrefixes.find((prefix) => filename.startsWith(prefix)) !== undefined;

patches.internalModuleReadJSON = function (original, ...args) {
    const [filepath] = args;
    if (isVirtual(filepath)) {
        try {
            return stdFs.readFileSync(filepath, "utf8");
        } catch (err) {
            //
        }
    } else {
        return original.apply(this, args);
    }
};

// TODO: need optimization
patches.internalModuleStat = function (original, ...args) {
    const [filepath] = args;

    if (isVirtual(filepath)) {
        try {
            const stat = stdFs.statSync(filepath);
            return stat.isDirectory() ? 1 : 0;
        } catch (err) {
            return -err.errno;
        }
    }
    return original.apply(this, args);
};


const mappings = new Map();
for (const vol of __kri__.volumes.values()) {
    if (vol.mapping.length > 0) {
        mappings.set(vol.mapping, vol.name);
    }
}

Object.assign(nfsBackup, nfs);

const kriFs = stdFs.mock(nfs);
__kri__.fs = stdFs;
__kri__.restoreFs = kriFs.restore;

const mod = require("module");
const origResolveFilename = mod.Module._resolveFilename;
mod.Module._resolveFilename = function (request, parent, isMain, options) {
    const parts = request.split("/");
    const mapping = mappings.get(parts[0]);
    if (mapping !== undefined) {
        request = path.join(mapping, ...parts.slice(1));
    }
    const res = origResolveFilename.call(this, request, parent, isMain, options);
    return res;
};

// 3. Run main module
process.argv.splice(1, 0, __kri__.main);
require("module").runMain();
