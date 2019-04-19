import { BaseFileSystem } from "../file_system";
import { FileType } from "../node_fs_stats";
import { BaseFile } from "../file";
import { uint8Array2Buffer, buffer2Uint8array } from "../util";
import { ApiError } from "../api_error";

export class NativeFile extends BaseFile {
    constructor(_fs, _FS, _path, _stream) {
        super();
        this._fs = _fs;
        this._FS = _FS;
        this._path = _path;
        this._stream = _stream;
    }

    getPos() {
        return undefined;
    }

    close(cb) {
        let err = null;
        try {
            this.closeSync();
        } catch (e) {
            err = e;
        } finally {
            cb(err);
        }
    }

    closeSync() {
        try {
            this._FS.close(this._stream);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    stat(cb) {
        try {
            cb(null, this.statSync());
        } catch (e) {
            cb(e);
        }
    }

    statSync(options) {
        return this._fs.statSync(this._path, options);
    }

    truncate(len, cb) {
        let err = null;
        try {
            this.truncateSync(len);
        } catch (e) {
            err = e;
        } finally {
            cb(err);
        }
    }

    truncateSync(len) {
        try {
            this._FS.ftruncate(this._stream.fd, len);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    write(buffer, offset, length, position, cb) {
        try {
            cb(null, this.writeSync(buffer, offset, length, position), buffer);
        } catch (e) {
            cb(e);
        }
    }

    writeSync(buffer, offset, length, position) {
        try {
            const u8 = buffer2Uint8array(buffer);
            // Emscripten is particular about what position is set to.
            const emPosition = position === null ? undefined : position;
            return this._FS.write(this._stream, u8, offset, length, emPosition);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    read(buffer, offset, length, position, cb) {
        try {
            cb(null, this.readSync(buffer, offset, length, position), buffer);
        } catch (e) {
            cb(e);
        }
    }

    readSync(buffer, offset, length, position) {
        try {
            const u8 = buffer2Uint8array(buffer);
            // Emscripten is particular about what position is set to.
            const emPosition = position === null ? undefined : position;
            return this._FS.read(this._stream, u8, offset, length, emPosition);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    sync(cb) {
        // NOP.
        cb();
    }

    syncSync() {
        // NOP.
    }

    chown(uid, gid, cb) {
        let err = null;
        try {
            this.chownSync(uid, gid);
        } catch (e) {
            err = e;
        } finally {
            cb(err);
        }
    }

    chownSync(uid, gid) {
        try {
            this._FS.fchown(this._stream.fd, uid, gid);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    chmod(mode, cb) {
        let err = null;
        try {
            this.chmodSync(mode);
        } catch (e) {
            err = e;
        } finally {
            cb(err);
        }
    }

    chmodSync(mode) {
        try {
            this._FS.fchmod(this._stream.fd, mode);
        } catch (e) {
            throw convertError(e, this._path);
        }
    }

    utimes(atime, mtime, cb) {
        let err = null;
        try {
            this.utimesSync(atime, mtime);
        } catch (e) {
            err = e;
        } finally {
            cb(err);
        }
    }

    utimesSync(atime, mtime) {
        this._fs.utimesSync(this._path, atime, mtime);
    }
}
/**
 * Mounts an native file system into the KRI file system.
 */
export default class NativeFS extends BaseFileSystem {
    constructor(fs) {
        super();
        this._fs = fs;
    }

    static create({ fs } = {}) {
        return new NativeFS(fs);
    }

    static isAvailable() {
        return true;
    }

    getName() {
        return this._fs.DB_NAME();
    }

    isReadOnly() {
        return false;
    }

    supportsLinks() {
        return true;
    }

    supportsProps() {
        return true;
    }

    supportsSynch() {
        return true;
    }

    mkdir(path, options, callback) {
        this._fs.mkdir(path, options, callback);
    }

    mkdirSync(path, options) {
        return this._fs.mkdirSync(path, options);
    }

    realpathSync(path, options) {
        return this._fs.realpathSync(path, options);
    }

    renameSync(oldPath, newPath) {
        this._fs.renameSync(oldPath, newPath);
    }

    stat(path, options, callback) {
        this._fs.stat(path, options, callback);
    }

    statSync(path, options) {
        return this._fs.statSync(path, options);
    }

    lstat(path, options, callback) {
        this._fs.lstat(path, options, callback);
    }

    lstatSync(path, options) {
        return this._fs.lstatSync(path, options);
    }

    open(path, flags, mode, callback) {
        this._fs.open(path, flags, mode, callback);
    }

    openSync(p, flags, mode) {
        return this._fs.open(p, flags, mode);
    }

    unlinkSync(p) {
        this._fs.unlinkSync(p);
    }

    rmdirSync(p) {
        this._fs.rmdirSync(p);
    }

    readdirSync(p, options) {
        return this._fs.readdirSync(p, options);
    }

    truncateSync(p, len) {
        this._fs.truncateSync(p, len);
    }

    readFile(path, { encoding, flag }, callback) {
        this._fs.readFile(path, { encoding, flag: flag.getFlagString() }, callback);
    }

    readFileSync(path, { encoding, flag }) {
        return this._fs.readFileSync(path, { encoding, flag: flag.getFlagString() });
    }

    writeFile(file, data, options, callback) {
        this._fs.writeFile(file, data, options, callback);
    }

    writeFileSync(file, data, options) {
        return this._fs.writeFileSync(file, data, options);
    }

    chmodSync(p, isLchmod, mode) {
        try {
            isLchmod ? this._fs.lchmod(p, mode) : this._fs.chmod(p, mode);
        } catch (e) {
            throw convertError(e, p);
        }
    }

    chownSync(p, isLchown, uid, gid) {
        try {
            isLchown ? this._fs.lchown(p, uid, gid) : this._fs.chown(p, uid, gid);
        } catch (e) {
            throw convertError(e, p);
        }
    }

    symlinkSync(srcpath, dstpath, type) {
        try {
            this._fs.symlink(srcpath, dstpath);
        } catch (e) {
            throw convertError(e);
        }
    }

    readlinkSync(p) {
        try {
            return this._fs.readlink(p);
        } catch (e) {
            throw convertError(e, p);
        }
    }

    utimesSync(p, atime, mtime) {
        try {
            this._fs.utime(p, atime.getTime(), mtime.getTime());
        } catch (e) {
            throw convertError(e, p);
        }
    }

    modeToFileType(mode) {
        if (this._fs.isDir(mode)) {
            return FileType.DIRECTORY;
        } else if (this._fs.isFile(mode)) {
            return FileType.FILE;
        } else if (this._fs.isLink(mode)) {
            return FileType.SYMLINK;
        }
        throw ApiError.EPERM(`Invalid mode: ${mode}`);
    }
}
NativeFS.options = {
    fs: {
        type: "object",
        description: "The node native fs module"
    }
};
