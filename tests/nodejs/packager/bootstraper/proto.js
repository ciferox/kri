const {
    fs: kriFs
} = kri;

export default (execPath, checkpoint) => {
    const EOF_SIG = Buffer.from("nodeadonekri");
    const EOF_HEADER_SIZE = 64;
    const EOF_VERSION = 1;
    const MAX_VOLUMES = 64;

    const fs = require("fs");
    const fd = fs.openSync(execPath, "r");
    const stat = fs.statSync(execPath);
    const commonHeader = Buffer.allocUnsafe(EOF_HEADER_SIZE);
    let currentPos = stat.size - EOF_HEADER_SIZE;

    fs.readSync(fd, commonHeader, 0, EOF_HEADER_SIZE, currentPos);
    if (!commonHeader.slice(0, EOF_SIG.length).equals(EOF_SIG)) {
        throw new Error("Invalid signature of EOF");
    }

    const version = commonHeader.readUInt16BE(12);
    if (version > EOF_VERSION) {
        throw new Error("Unsupported version of EOF");
    }

    const volumesNum = commonHeader.readInt16BE(14);

    if (volumesNum < 1 || volumesNum > MAX_VOLUMES) {
        throw new RangeError(`Number of volumes out of range: ${volumesNum}`);
    }

    const volumes = [];
    const mounts = {};

    let sectionHdrSize = commonHeader.readUInt32BE(16);
    let sectionSize = commonHeader.readUInt32BE(20);
    let i = 0;

    while (sectionSize > 0 && sectionHdrSize > 0) {
        const section = Buffer.allocUnsafe(sectionSize);
        currentPos -= sectionSize;
        fs.readSync(fd, section, 0, sectionSize, currentPos);
        const header = section.slice(0, sectionHdrSize);

        const headerSize = header.readUInt32BE(0);
        // console.log("another hdr size", headerSize);

        if (headerSize !== sectionHdrSize) {
            throw new Error("Invalid volume header size");
        }

        const dataSize = header.readUInt32BE(4);

        if (dataSize !== (sectionSize - sectionHdrSize)) {
            throw new Error("Invalid section data size");
        }

        const nameSize = header.readUInt32BE(8);
        const indexSize = header.readUInt32BE(12);

        const name = header.slice(24, 24 + nameSize).toString("utf8");
        if (!name.startsWith("/")) {
            throw new Error(`Invalid volume mount name: ${name}`);
        }

        let index;
        if (indexSize > 0) {
            index = header.slice(24 + nameSize, 24 + nameSize + indexSize).toString("utf8");
        } else if (i === 0) {
            index = "index.js";
        }

        const data = section.slice(sectionHdrSize);
        volumes.push({
            name,
            index,
            data
        });

        mounts[name] = {
            fs: "ZipFS",
            options: {
                zipData: data
            }
        };

        sectionHdrSize = header.readUInt32BE(16);
        sectionSize = header.readUInt32BE(20);

        i++;
    }

    // Define loader at global scope
    Object.defineProperty(global, "__kri_loader__", {
        enumerable: true,
        configurable: true, // should be commited in release
        value: {
            kriFs,
            volumes
        }
    });

    if (checkpoint === "volumes:loaded") {
        return;
    }


    return new Promise((resolve, reject) => {
        kriFs.configure({
            fs: "MountableFileSystem",
            options: mounts
        }, (e) => {
            if (e) {
                console.error(e.stack);
                // process.exit(1);
                reject(e);
                return;
            }

            const vfs = kriFs.BFSRequire("fs");

            global.__kri_loader__.vfs = vfs;

            if (checkpoint === "volumes:mounted") {
                resolve();
                return;
            }

            const fsProps = [
                "constants",
                "F_OK",
                "R_OK",
                "W_OK",
                "X_OK",
                "Stats"
            ];

            const fsSyncMethods = [
                "renameSync",
                "ftruncateSync",
                "truncateSync",
                "chownSync",
                "fchownSync",
                "lchownSync",
                "chmodSync",
                "fchmodSync",
                "lchmodSync",
                "statSync",
                "lstatSync",
                "fstatSync",
                "linkSync",
                "symlinkSync",
                "readlinkSync",
                "realpathSync",
                "unlinkSync",
                "rmdirSync",
                "mkdirSync",
                "mkdirpSync",
                "readdirSync",
                "closeSync",
                "openSync",
                "utimesSync",
                "futimesSync",
                "fsyncSync",
                "writeSync",
                "readSync",
                "readFileSync",
                "writeFileSync",
                "appendFileSync",
                "existsSync",
                "accessSync",
                "fdatasyncSync",
                "mkdtempSync",
                "copyFileSync",

                "createReadStream",
                "createWriteStream"
            ];

            const fsAsyncMethods = [
                "rename",
                "ftruncate",
                "truncate",
                "chown",
                "fchown",
                "lchown",
                "chmod",
                "fchmod",
                "lchmod",
                "stat",
                "lstat",
                "fstat",
                "link",
                "symlink",
                "readlink",
                "realpath",
                "unlink",
                "rmdir",
                "mkdir",
                "mkdirp",
                "readdir",
                "close",
                "open",
                "utimes",
                "futimes",
                "fsync",
                "write",
                "read",
                "readFile",
                "writeFile",
                "appendFile",
                "exists",
                "access",
                "fdatasync",
                "mkdtemp",
                "copyFile",

                "watchFile",
                "unwatchFile",
                "watch"
            ];

            // Patch fs module
            const original = {};

            const patch = (key, newValue) => {
                original[key] = fs[key];
                fs[key] = newValue;
            };

            const patchMethod = (key) => patch(key, vfs[key].bind(vfs));

            for (const prop of fsProps) {
                if (typeof vfs[prop] !== "undefined") {
                    patch(prop, vfs[prop]);
                }
            }

            for (const method of fsAsyncMethods) {
                if (typeof vfs[method] === "function") {
                    patchMethod(method);
                }
            }


            for (const method of fsSyncMethods) {
                if (typeof vfs[method] === "function") {
                    patchMethod(method);
                }
            }

            // Extra functions
            patchMethod("_toUnixTimestamp");

            global.__kri_loader__.unpatchFs = () => {
                for (const key in original) {
                    fs[key] = original[key];
                }
            };

            if (checkpoint === "fs:patched") {
                resolve();
                return;
            }
        });
    });
};
