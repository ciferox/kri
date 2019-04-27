import StdFileSystem from "./std_fs";
// import MemoryFileSystem from "./memory_fs";
import ZipFileSystem from "./zip_fs";
import fsMethods from "./fs_methods";
import path from "../../path";

const binding = process.binding("fs");
const {
    fstat: bindingFstat,
    FSReqCallback,
    writeBuffers
} = binding;

class KRIInitSubsystem {
    constructor() {
        this.nfsBackup = {};
        this.fs = new StdFileSystem();
        this.nfs = require("fs");
        this.module = require("module");
        this.mappings = new Map();

        __kri__.initSubsystem = this;

        // define global '__custom_adone_fs__' that will be used in 'adone.fs' instead of default.
        global.__custom_base_fs__ = this.nfs;
    }

    mountVolumes() {
        const volumes = __kri__.volumes;
        const mountPoints = [];
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

            if (volume.mapping.length > 0) {
                this.mappings.set(volume.mapping, volume.name);
            }

            this.fs.mount(fs, volume.name);
            mountPoints.push(volume.name);
        }

        this.isVirtual = (filename) => mountPoints.find((prefix) => filename.startsWith(prefix)) !== undefined;
    }

    patchInternals() {
        const nfs = this.nfs;
        const fs = this.fs;

        // patch native fs

        for (const method of fsMethods) {
            this.nfsBackup[method] = nfs[method];
            nfs[method] = (...args) => fs[method](...args);
        }

        // patch process.binding("fs")

        // We have to override this method, because otherwise native readFileSync()
        // will call binding.fstat() with the wrong file descriptor.
        binding.fstat = (mappedFd, ...args) => {
            const old = Error.prepareStackTrace;
            Error.prepareStackTrace = (_, stack) => stack;
            const stack = new Error().stack.slice(1);
            Error.prepareStackTrace = old;
            const fdi = fs._fdMap.get(mappedFd);
            let fd;
            if (fdi && stack[0].getFunctionName() === "tryStatSync") {
                fd = fdi.fd;
            } else {
                fd = mappedFd;
            }
            return bindingFstat(fd, ...args);
        };

        const { internalPatches: patches } = __kri__;
        const isVirtual = this.isVirtual;
        patches.internalModuleReadJSON = function (original, ...args) {
            const [filepath] = args;
            if (isVirtual(filepath)) {
                try {
                    return fs.readFileSync(filepath, "utf8");
                } catch (err) {
                    //
                }
            } else {
                return original.apply(this, args);
            }
        };

        patches.internalModuleStat = function (original, ...args) {
            const [filepath] = args;

            if (isVirtual(filepath)) {
                try {
                    const stats = fs.statSync(filepath);
                    return stats.isDirectory() ? 1 : 0;
                } catch (err) {
                    return -err.errno;
                }
            }
            return original.apply(this, args);
        };

        // patch fs streams

        // Override WriteStream.prototype._write() so the correct file descriptor is passed to the binding.writeBuffers(). 
        const writev = function (fd, chunks, position, callback) {
            const wrapper = function (err, written) {
                // Retain a reference to chunks so that they can't be GC'ed too soon.
                callback(err, written || 0, chunks);
            };

            const req = new FSReqCallback();
            req.oncomplete = wrapper;
            writeBuffers(fd, chunks, position, req);
        };

        this.origWriteStreamWritev = nfs.WriteStream.prototype._writev;
        nfs.WriteStream.prototype._writev = function (data, cb) {
            if (typeof this.fd !== "number") {
                return this.once("open", function () {
                    this._writev(data, cb);
                });
            }

            const self = this;
            const len = data.length;
            const chunks = new Array(len);
            let size = 0;

            for (let i = 0; i < len; i++) {
                const chunk = data[i].chunk;

                chunks[i] = chunk;
                size += chunk.length;
            }

            const { fd } = fs._fdMap.get(this.fd);
            writev(fd, chunks, this.pos, (er, bytes) => {
                if (er) {
                    self.destroy();
                    return cb(er);
                }
                self.bytesWritten += bytes;
                cb();
            });

            if (this.pos !== undefined) {
                this.pos += size;
            }
        };

        // patch 'module' 

        const mod = this.module;
        const mappings = this.mappings;
        const origResolveFilename = this.origResolveFilename = mod.Module._resolveFilename;
        mod.Module._resolveFilename = function (request, parent, isMain, options) {
            const parts = request.split("/");
            const mapping = mappings.get(parts[0]);
            if (mapping !== undefined) {
                request = path.join(mapping, ...parts.slice(1));
            }
            const res = origResolveFilename.call(this, request, parent, isMain, options);
            return res;
        };
    }

    unpatchInternals() {
        for (const method of fsMethods) {
            this.nfs[method] = this.nfsBackup[method];
        }

        binding.fstat = bindingFstat;
        const { internalPatches: patches } = __kri__;
        patches.internalModuleReadJSON = __kri__.noopHook;
        patches.internalModuleStat = __kri__.noopHook;

        this.nfs.WriteStream.prototype._writev = this.origWriteStreamWritev;
        this.module.Module._resolveFilename = this.origResolveFilename;
    }

    runMainModule() {
        process.argv.splice(1, 0, __kri__.main);
        this.module.runMain();
    }
}

const kriInit = new KRIInitSubsystem();

// 1.
kriInit.mountVolumes();

// 2.
kriInit.patchInternals();

// 3.
kriInit.runMainModule();
