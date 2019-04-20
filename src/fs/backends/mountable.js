/* eslint-disable adone/no-null-comp */
/* eslint-disable func-style */
import { BaseFileSystem } from "../file_system";
import MemoryFS from "./memory";
import { ApiError, ErrorCode } from "../api_error";
import fs from "../index";
import * as path from "path";
import { mkdirpSync } from "../util";

/**
 * The MountableFileSystem allows you to mount multiple backend types or
 * multiple instantiations of the same backend into a single file system tree.
 * The file systems do not need to know about each other; all interactions are
 * automatically facilitated through this interface.
 *
 * For example, if a file system is mounted at /mnt/blah, and a request came in
 * for /mnt/blah/foo.txt, the file system would see a request for /foo.txt.
 *
 * You can mount file systems when you configure the file system:
 * ```javascript
 * BrowserFS.configure({
 *   fs: "MountableFileSystem",
 *   options: {
 *     '/data': { fs: 'HTTPRequest', options: { index: "http://mysite.com/files/index.json" } },
 *     '/home': { fs: 'LocalStorage' }
 *   }
 * }, function(e) {
 *
 * });
 * ```
 *
 * For advanced users, you can also mount file systems *after* MFS is constructed:
 * ```javascript
 * BrowserFS.FileSystem.HTTPRequest.Create({
 *   index: "http://mysite.com/files/index.json"
 * }, function(e, xhrfs) {
 *   BrowserFS.FileSystem.MountableFileSystem.Create({
 *     '/data': xhrfs
 *   }, function(e, mfs) {
 *     BrowserFS.initialize(mfs);
 *
 *     // Added after-the-fact...
 *     BrowserFS.FileSystem.LocalStorage.Create(function(e, lsfs) {
 *       mfs.mount('/home', lsfs);
 *     });
 *   });
 * });
 * ```
 *
 * Since MountableFileSystem simply proxies requests to mounted file systems, it supports all of the operations that the mounted file systems support.
 *
 * With no mounted file systems, `MountableFileSystem` acts as a simple `InMemory` filesystem.
 */
export default class MountableFS extends BaseFileSystem {
    /**
     * Creates a new, empty MountableFileSystem.
     */
    constructor(rootFs) {
        super();
        // Contains the list of mount points in mntMap, sorted by string length in decreasing order.
        // Ensures that we scan the most specific mount points for a match first, which lets us
        // nest mount points.
        this.mountList = [];
        this.mntMap = {};
        this.rootFs = rootFs;
    }

    /**
     * Creates a MountableFileSystem instance with the given options.
     */
    static create(options = {}) {
        const imfs = MemoryFS.create();
        if (imfs) {
            const fs = new MountableFS(imfs);
            Object.keys(options).forEach((mountPoint) => {
                fs.mount(mountPoint, options[mountPoint]);
            });
            return fs;
        }
    }

    static isAvailable() {
        return true;
    }

    /**
     * Mounts the file system at the given mount point.
     */
    mount(mountPoint, fs) {
        if (mountPoint[0] !== "/") {
            mountPoint = `/${mountPoint}`;
        }
        mountPoint = path.resolve(mountPoint);
        if (this.mntMap[mountPoint]) {
            throw new ApiError(ErrorCode.EINVAL, `Mount point ${mountPoint} is already taken.`);
        }
        mkdirpSync(mountPoint, 0x1ff, this.rootFs);
        this.mntMap[mountPoint] = fs;
        this.mountList.push(mountPoint);
        this.mountList = this.mountList.sort((a, b) => b.length - a.length);
    }

    umount(mountPoint) {
        if (mountPoint[0] !== "/") {
            mountPoint = `/${mountPoint}`;
        }
        mountPoint = path.resolve(mountPoint);
        if (!this.mntMap[mountPoint]) {
            throw new ApiError(ErrorCode.EINVAL, `Mount point ${mountPoint} is already unmounted.`);
        }
        delete this.mntMap[mountPoint];
        this.mountList.splice(this.mountList.indexOf(mountPoint), 1);
        while (mountPoint !== "/") {
            if (this.rootFs.readdirSync(mountPoint).length === 0) {
                this.rootFs.rmdirSync(mountPoint);
                mountPoint = path.dirname(mountPoint);
            } else {
                break;
            }
        }
    }

    /**
     * Returns the file system that the path points to.
     */
    _getFs(path) {
        const mountList = this.mountList; const len = mountList.length;
        for (let i = 0; i < len; i++) {
            const mountPoint = mountList[i];
            // We know path is normalized, so it is a substring of the mount point.
            if (mountPoint.length <= path.length && path.indexOf(mountPoint) === 0) {
                path = path.substr(mountPoint.length > 1 ? mountPoint.length : 0);
                if (path === "") {
                    path = "/";
                }
                return { fs: this.mntMap[mountPoint], path, mountPoint };
            }
        }
        // Query our root file system.
        return { fs: this.rootFs, path, mountPoint: "/" };
    }

    // Global information methods
    getName() {
        return MountableFS.name;
    }

    diskSpace(path, cb) {
        cb(0, 0);
    }

    isReadOnly() {
        return false;
    }

    supportsLinks() {
        // I'm not ready for cross-FS links yet.
        return false;
    }

    supportsProps() {
        return false;
    }

    supportsSynch() {
        return true;
    }

    /**
     * Fixes up error messages so they mention the mounted file location relative
     * to the MFS root, not to the particular FS's root.
     * Mutates the input error, and returns it.
     */
    standardizeError(err, path, realPath) {
        const index = err.message.indexOf(path);
        if (index !== -1) {
            err.message = err.message.substr(0, index) + realPath + err.message.substr(index + path.length);
            err.path = realPath;
        }
        return err;
    }

    // The following methods involve multiple file systems, and thus have custom
    // logic.
    // Note that we go through the Node API to use its robust default argument
    // processing.
    rename(oldPath, newPath, cb) {
        // Scenario 1: old and new are on same FS.
        const fs1rv = this._getFs(oldPath);
        const fs2rv = this._getFs(newPath);
        if (fs1rv.fs === fs2rv.fs) {
            return fs1rv.fs.rename(fs1rv.path, fs2rv.path, (e) => {
                if (e) {
                    this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                }
                cb(e);
            });
        }
        // Scenario 2: Different file systems.
        // Read old file, write new file, delete old file.
        return fs.readFile(oldPath, (err, data) => {
            if (err) {
                return cb(err);
            }
            fs.writeFile(newPath, data, (err) => {
                if (err) {
                    return cb(err);
                }
                fs.unlink(oldPath, cb);
            });
        });
    }

    renameSync(oldPath, newPath) {
        // Scenario 1: old and new are on same FS.
        const fs1rv = this._getFs(oldPath);
        const fs2rv = this._getFs(newPath);
        if (fs1rv.fs === fs2rv.fs) {
            try {
                return fs1rv.fs.renameSync(fs1rv.path, fs2rv.path);
            } catch (e) {
                this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                throw e;
            }
        }
        // Scenario 2: Different file systems.
        const data = fs.readFileSync(oldPath);
        fs.writeFileSync(newPath, data);
        return fs.unlinkSync(oldPath);
    }

    readdirSync(p, options) {
        const fsInfo = this._getFs(p);
        // If null, rootfs did not have the directory
        // (or the target FS is the root fs).
        let rv = null;
        // Mount points are all defined in the root FS.
        // Ensure that we list those, too.
        if (fsInfo.fs !== this.rootFs) {
            try {
                rv = this.rootFs.readdirSync(p, options);
            } catch (e) {
                // Ignore.
            }
        }
        try {
            const rv2 = fsInfo.fs.readdirSync(fsInfo.path, options);
            if (rv === null) {
                return rv2;
            }
            // Filter out duplicates.
            return rv2.concat(rv.filter((val) => !rv2.includes(val)));

        } catch (e) {
            if (rv === null) {
                throw this.standardizeError(e, fsInfo.path, p);
            } else {
                // The root FS had something.
                return rv;
            }
        }
    }

    readdir(p, options, cb) {
        const fsInfo = this._getFs(p);
        fsInfo.fs.readdir(fsInfo.path, options, (err, files) => {
            if (fsInfo.fs !== this.rootFs) {
                try {
                    const rv = this.rootFs.readdirSync(p, options);
                    if (files) {
                        // Filter out duplicates.
                        files = files.concat(rv.filter((val) => !files.includes(val)));
                    } else {
                        files = rv;
                    }
                } catch (e) {
                    // Root FS and target FS did not have directory.
                    if (err) {
                        return cb(this.standardizeError(err, fsInfo.path, p));
                    }
                }
            } else if (err) {
                // Root FS and target FS are the same, and did not have directory.
                return cb(this.standardizeError(err, fsInfo.path, p));
            }
            cb(null, files);
        });
    }

    realpathSync(p, options) {
        const fsInfo = this._getFs(p);
        try {
            const mountedPath = fsInfo.fs.realpathSync(fsInfo.path, {});
            // resolve is there to remove any trailing slash that may be present
            return path.resolve(path.join(fsInfo.mountPoint, mountedPath));
        } catch (e) {
            throw this.standardizeError(e, fsInfo.path, p);
        }
    }

    realpath(p, options, cb) {
        const fsInfo = this._getFs(p);
        fsInfo.fs.realpath(fsInfo.path, {}, (err, rv) => {
            if (err) {
                cb(this.standardizeError(err, fsInfo.path, p));
            } else {
                // resolve is there to remove any trailing slash that may be present
                cb(null, path.resolve(path.join(fsInfo.mountPoint, rv)));
            }
        });
    }

    rmdirSync(p) {
        const fsInfo = this._getFs(p);
        if (this._containsMountPt(p)) {
            throw ApiError.ENOTEMPTY(p);
        } else {
            try {
                fsInfo.fs.rmdirSync(fsInfo.path);
            } catch (e) {
                throw this.standardizeError(e, fsInfo.path, p);
            }
        }
    }

    rmdir(p, cb) {
        const fsInfo = this._getFs(p);
        if (this._containsMountPt(p)) {
            cb(ApiError.ENOTEMPTY(p));
        } else {
            fsInfo.fs.rmdir(fsInfo.path, (err) => {
                cb(err ? this.standardizeError(err, fsInfo.path, p) : null);
            });
        }
    }

    /**
     * Returns true if the given path contains a mount point.
     */
    _containsMountPt(p) {
        const mountPoints = this.mountList; const len = mountPoints.length;
        for (let i = 0; i < len; i++) {
            const pt = mountPoints[i];
            if (pt.length >= p.length && pt.slice(0, p.length) === p) {
                return true;
            }
        }
        return false;
    }
}
MountableFS.options = {};
/**
 * Tricky: Define all of the functions that merely forward arguments to the
 * relevant file system, or return/throw an error.
 * Take advantage of the fact that the *first* argument is always the path, and
 * the *last* is the callback function (if async).
 * @hidden
 */
function defineFcn(name, isSync) {
    if (isSync) {
        return function (...args) {
            const path = args[0];
            const rv = this._getFs(path);
            args[0] = rv.path;
            // try {
            return rv.fs[name].apply(rv.fs, args);
            // } catch (e) {
            //     this.standardizeError(e, rv.path, path);
            //     throw e;
            // }
        };
    }
    return function (...args) {
        const path = args[0];
        const rv = this._getFs(path);
        args[0] = rv.path;
        // if (typeof (args[args.length - 1]) === "function") {
        //     const cb = args[args.length - 1];
        //     args[args.length - 1] = (...args) => {
        //         if (args.length > 0 && args[0] instanceof ApiError) {
        //             this.standardizeError(args[0], rv.path, path);
        //         }
        //         cb.apply(null, args);
        //     };
        // }
        return rv.fs[name].apply(rv.fs, args);
    };

}

const fsCmdMap = [
    "createWriteStream", "createReadStream",
    "exists", "unlink", "readlink",
    "access", "stat", "lstat", "mkdir", "truncate",
    "open", "readFile", "chmod", "utimes", "writeFile",
    "chown",
    "appendFile"
];
for (const fnName of fsCmdMap) {
    MountableFS.prototype[fnName] = defineFcn(fnName, false);
    MountableFS.prototype[`${fnName}Sync`] = defineFcn(`${fnName}Sync`, true);
}
