/* eslint-disable adone/no-undefined-comp */
/* eslint-disable adone/no-typeof */
/* eslint-disable adone/no-null-comp */
/* eslint-disable adone/no-typeof */

import FS from "./fs";
import backend from "./backends";
import * as error from "./api_error";
import path from "path";

const IGNORE_NAME = ["constructor", "initialize", "getRootFS", "getFdForFile", "nfs", "nfsBackup", "volumes"];

const nfs = require("fs");
const nfsCopy = Object.assign({}, nfs); // need for native mounting
let nfsBackup = null;

class KRIFs {
    constructor() {
        this.volumes = null;

        const fs = new FS();
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

        const mntFs = backend.mountable.create();
        const nativeFs = backend.native.create({
            fs: nfsCopy
        });
        mntFs.mount("/", nativeFs);

        for (const volume of volumes.values()) {
            let fs;
            switch (volume.type) {
                case "zip":
                    fs = backend[volume.type].create({
                        data: volume.data
                    });
                    break;
                default:
                    throw new Error(`Unknown fs backend: ${volume.fs}`);
            }

            mntFs.mount(volume.name, fs);
        }

        this.initialize(mntFs);
    }

    patchNative() {
        if (nfsBackup !== null) {
            throw new Error("Already patched");
        }
        nfsBackup = {};

        if (global.__kri__) {
            const { internalPatches: patches } = global.__kri__;

            // TODO: need reimplement
            const volumePathPrefixes = [...this.volumes.keys()];
            const isVirtual = (filename) => typeof (filename) === "string" && volumePathPrefixes.find((prefix) => filename.startsWith(prefix)) !== undefined;

            const self = this;
            patches.internalModuleReadJSON = function (original, ...args) {
                const [filepath] = args;
                if (isVirtual(filepath)) {
                    try {
                        return self.readFileSync(filepath, "utf-8");
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
                        const stat = self.statSync(filepath);
                        return stat.isDirectory() ? 1 : 0;
                    } catch (err) {
                        return -err.errno;
                    }
                }
                return original.apply(this, args);
            };
        }


        const mappings = new Map();
        for (const vol of this.volumes.values()) {
            if (vol.mapping.length > 0) {
                mappings.set(vol.mapping, vol.name);
            }
        }

        Object.assign(nfsBackup, nfs);

        for (const key of Object.getOwnPropertyNames(this).filter((n) => !IGNORE_NAME.includes(n))) {
            nfs[key] = this[key];
        }
        nfs.Stats = this.Stats;

        if (global.__kri__) {
            // TODO: unpatch this
            const mod = require("module");
            const origResolveFilename = mod.Module._resolveFilename;
            mod.Module._resolveFilename = function (request, parent, isMain, options) {
                const parts = request.split(path.sep);
                const mapping = mappings.get(parts[0]);
                if (mapping !== undefined) {
                    request = path.join(mapping, ...parts.slice(1));
                }
                const res = origResolveFilename.call(this, request, parent, isMain, options);
                return res;
            };
        }
    }

    unpatchNative() {
        if (nfsBackup !== null) {
            for (const key of Object.getOwnPropertyNames(this).filter((n) => !IGNORE_NAME.includes(n))) {
                nfs[key] = nfsBackup[key];
            }
            nfsBackup = null;
        }
    }
}
KRIFs.prototype.FS = FS;
KRIFs.prototype.Stats = FS.Stats;
KRIFs.prototype.backend = backend;
KRIFs.prototype.error = error;

const kriFs = new KRIFs();
kriFs.isNativePatched = () => nfs !== null;

export default kriFs;
