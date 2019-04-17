/* eslint-disable adone/no-undefined-comp */
/* eslint-disable adone/no-typeof */
/* eslint-disable adone/no-null-comp */
/* eslint-disable adone/no-typeof */

import FS from "./fs";
import backend from "./backends";
import * as error from "./api_error";

// if (process.initializeTTYs) {
//     process.initializeTTYs();
// }
const fs = new FS();

const IGNORE_NAME = ["constructor", "initialize", "getRootFS", "getFdForFile", "nfs", "nfsBackup", "volumes"];

let nfs = null;
const nfsBackup = {};

class KRIFs {
    constructor() {
        this.volumes = null;

        Object.getOwnPropertyNames(FS.prototype).forEach((key) => {
            if (typeof fs[key] === "function") {

                this[key] = (...args) => {
                    return fs[key].apply(fs, args);
                };
            } else if (key !== "constructor") {
                this[key] = fs[key];
            }
        });
    }

    mountVolumes(volumes) {
        this.volumes = volumes;
        const options = {};

        for (const { name, data } of volumes) {
            options[name] = {
                fs: "ZipFS",
                options: {
                    zipData: data
                }
            };
        }

        this.initialize(this.createFileSystem({
            fs: "MountableFileSystem",
            options
        }));
    }

    patchNative() {
        if (nfs !== null) {
            throw new Error("Already patched");
        }

        if (global.__kri__) {
            const { internalPatches: patches } = global.__kri__;

            // TODO: need reimplement
            const volumePathPrefixes = this.volumes.map((info) => info.name);
            const isVirtual = (filename) => typeof (filename) === "string" && volumePathPrefixes.find((prefix) => filename.startsWith(prefix)) !== undefined;

            const self = this;
            patches.internalModuleReadJSON = function (original, ...args) {
                const [filepath] = args;
                return isVirtual(filepath)
                    ? self.readFileSync(filepath, "utf-8")
                    : original.call(this, ...args);
            };
            // TODO: need optimization
            patches.internalModuleStat = function (original, ...args) {
                const [filepath] = args;

                if (isVirtual(filepath)) {
                    try {
                        const stat = self.statSync(filepath);
                        return stat.isDirectory() ? 1 : 0;
                    } catch (err) {
                        return -1; // Fix this
                    }
                }
                return original.call(this, ...args);
            };
        }

        nfs = require("fs");
        Object.assign(nfsBackup, nfs);

        for (const key of Object.getOwnPropertyNames(this).filter((n) => !IGNORE_NAME.includes(n))) {
            nfs[key] = this[key];
        }
        nfs.Stats = this.Stats;
    }

    unpatchNative() {
        if (nfs !== null) {
            for (const key of Object.getOwnPropertyNames(this).filter((n) => !IGNORE_NAME.includes(n))) {
                nfs[key] = nfsBackup[key];
            }
            nfs = null;
        }
    }

    createFileSystem(config) {
        const fsName = config.fs;
        if (!fsName) {
            throw new error.ApiError(error.ErrorCode.EPERM, 'Missing "fs" property on configuration object.');
        }
        const options = config.options;

        if (options !== null && typeof (options) === "object") {
            const props = Object.keys(options).filter((k) => k !== "fs");
            // Check recursively if other fields have 'fs' properties.
            for (const p of props) {
                const d = options[p];
                if (d !== null && typeof (d) === "object" && d.fs) {
                    options[p] = this.createFileSystem(d);
                }
            }
        }

        const BackendClass = backend[fsName];
        if (!BackendClass) {
            throw new error.ApiError(error.ErrorCode.EPERM, `Unknown file system: ${fsName}`);
        }
        return BackendClass.create(options);
    }
}
KRIFs.prototype.FS = FS;
KRIFs.prototype.Stats = FS.Stats;
KRIFs.prototype.backend = backend;
KRIFs.prototype.error = error;

const kriFs = new KRIFs();
kriFs.isNativePatched = () => nfs !== null;

export default kriFs;
