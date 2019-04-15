// --- KRI LOADER ---
//
// The 0-section is common and has a size of 64 bytes.
// The content of the section starting at offset 16 should be interpreted
// according to the version of EOF-data format.
//
// 0-section structure:
//
// description                    offset    size    value (default)
// ------------------------------------------------------------------
// signature                           0      12    'nodeadonekri'
// version of EOF-data format         12       2    1
// number of volumes                  14       2    
//
// All other sections represent volumes with header and data.
// First volume (with index 0) is a bootable (main app module/realm).
//
// header structure ():
//
// description                    offset    size    value (default)
// ------------------------------------------------------------------
// header size                         0       4
// data size                           0       4
// mount name length                   8       4
// mount name                         12   <var>
// entry path length               <var>       4 
// entry path                      <var>   <var>
//

const FOOTER_SIZE = 64;
const FOOTER_SIG = Buffer.from("nodeadonekri");

const SUPPORT_VERSION = 1;
const MAX_VOLUMES = 64;

const OFFSET_SIGNATURE = 0;
const OFFSET_VERSION = 12;
const OFFSET_VOLUMES = 14;

const fs = require("fs");
const fd = fs.openSync(process.execPath, "r");
const stat = fs.statSync(process.execPath);
const footer = Buffer.allocUnsafe(FOOTER_SIZE, 0);

fs.readSync(fd, footer, 0, FOOTER_SIZE, stat.size - FOOTER_SIZE);
if (!footer.slice(OFFSET_SIGNATURE, FOOTER_SIG.length).equals(FOOTER_SIG)) {
    throw new Error("Invalid signature of EOF");
}

const version = footer.readUInt16BE(OFFSET_VERSION);
if (version > SUPPORT_VERSION) {
    throw new Error("Unsupported version of EOF");
}

const volumesNum = footer.readInt16BE(OFFSET_VOLUMES);

if (volumesNum < 1 || volumesNum > MAX_VOLUMES) {
    throw new RangeError("Number of volumes out of range");
}

const volumes = [];
const mounts = {};

let baseOffset = stat.size - FOOTER_SIZE;
for (let i = 0; i < volumesNum; i++) {
    const endHdrOffset = baseOffset;
    baseOffset -= 4;
    const hdrSize = footer.readUInt32BE(baseOffset);
    baseOffset -= 4;
    const bodySize = footer.readUInt32BE(baseOffset);
    baseOffset -= 4;
    const nameSize = footer.readUInt32BE(baseOffset);
    baseOffset -= nameSize;
    const entrySize = footer.readUInt32BE(baseOffset);
    let entry;
    if (entrySize > 0) {
        baseOffset -= entrySize;
        entry = footer.slice(baseOffset, entrySize).toString("utf8");
    } else if (i === 0) {
        throw new Error("Unknown bootable entry path");
    }

    // Check correctness of header size
    if (endHdrOffset - baseOffset !== hdrSize) {
        throw new Error("Invalid volume header");
    }

    const name = footer.slice(baseOffset, nameSize).toString("utf8");
    baseOffset -= bodySize;
    const data = footer.slice(baseOffset, bodySize);

    volumes.push({
        name,
        entry,
        data
    });

    mounts[name] = {
        fs: "ZipFS",
        options: {
            zipData: data
        }
    };
}

kriFs.configure({
    fs: "MountableFileSystem",
    options: mounts
}, (e) => {
    if (e) {
        console.error(e.stack);
        process.exit(1);
        return;
    }

    // Shim fs module

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

    const vfs = kriFs.BFSRequire("fs");
    const fs = require("fs");

    const original = {};

    const patch = (key, newValue) => {
        original[key] = fs[key];
        fs[key] = newValue;
    };

    const patchMethod = (key) => patch(key, vfs[key].bind(vfs));

    // General properties
    for (const prop of fsProps) {
        if (typeof vfs[prop] !== "undefined") {
            patch(prop, vfs[prop]);
        }
    }

    // Main API
    for (const method of fsAsyncMethods) {
        if (typeof vol[method] === "function") {
            patchMethod(method);
        }
    }

    for (const method of fsSyncMethods) {
        if (typeof vol[method] === "function") {
            patchMethod(method);
        }
    }

    // Extra functions
    patchMethod("_toUnixTimestamp");

    // Define loader at global scope
    Object.defineProperty(global, "__kri_loader__", {
        enumerable: true,
        value: {
            kriFs,
            vfs,
            volumes,
            unpatchFs() {
                for (const key in original) { fs[key] = original[key]; }
            }
        }
    });

    // run
    if (!process.send) {
        const path = require("path");
        process.argv.splice(1, 0, path.join(volumes[0].name, volumes[0].entry));
    }

    const Module = require("module");
    Module.runMain();
});
