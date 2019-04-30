const LOADER_VERSION = 1;
const EOF_VERSION = 1;

const EOF_SIG = Buffer.from("nodeadonekri");
const EOF_HEADER_SIZE = 64;
const MAX_VOLUMES = 64;

const fs = require("fs");
const path = require("path");
const fd = fs.openSync(process.execPath, "r");
const stat = fs.statSync(process.execPath);

const readString = (buff, ctx) => {
    const { offset } = ctx;
    const sz = buff.readUInt16BE(offset);
    ctx.offset += 2;
    if (sz > 0) {
        ctx.offset += sz;
        return buff.slice(offset + 2, offset + 2 + sz).toString("utf8");
    }
    return "";
};

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

const volumes = new Map();

let sectionHdrSize = commonHeader.readUInt32BE(16);
let sectionSize = commonHeader.readUInt32BE(20);
const initSize = commonHeader.readUInt32BE(24);

if (initSize === 0) {
    throw new Error("Empty 'init' section");
}

const initCode = Buffer.allocUnsafe(initSize);
currentPos -= initSize;
fs.readSync(fd, initCode, 0, initSize, currentPos);

let i = 0;
let startupFile = null;

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

    const ctx = {
        offset: 24
    };

    const name = readString(header, ctx);
    if (!name.startsWith("/")) {
        throw new Error(`Invalid volume mount name: ${name}`);
    }

    const type = readString(header, ctx);
    if (!type) {
        throw new Error(`No filesystem type for: ${name}`);
    }

    const mapping = readString(header, ctx);

    let index = readString(header, ctx);

    if (index.length === 0) {
        index = "index.js";
    }

    const data = section.slice(sectionHdrSize);
    volumes.set(name, {
        type,
        name,
        mapping,
        index,
        data
    });

    if (i === 0) {
        startupFile = path.join(name, index);
    }

    sectionHdrSize = header.readUInt32BE(16);
    sectionSize = header.readUInt32BE(20);

    i++;
}

global.__kri__.volumes = volumes;
global.__kri__.main = startupFile;
global.__kri__.EOF_VERSION = EOF_VERSION;
global.__kri__.LOADER_VERSION = LOADER_VERSION;

const init = new Function("require", "__kri__", initCode.toString("utf8"));
init(require, global.__kri__);
