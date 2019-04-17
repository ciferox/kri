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

        sectionHdrSize = header.readUInt32BE(16);
        sectionSize = header.readUInt32BE(20);

        i++;
    }

    kriFs.mountVolumes(volumes);

    if (checkpoint === "volumes:mounted") {
        return;
    }

    kriFs.patchNative();
};
