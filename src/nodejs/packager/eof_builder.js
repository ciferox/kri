const {
    error,
    is,
    fs
} = adone;

//
// --- KRI EOF data format ---
//
// The 0-section is common - now it's only header with size of 64 bytes.
// The content of the section starting at offset 24 should be interpreted
// according to the version of EOF-data format.
// 
// There is a special section called 'init'. This section does not have a
// header and the loader interprets it as a function body.
//
// 0-section structure:
//
// description                    offset    size    value (default)
// ------------------------------------------------------------------
// signature                           0      12    'nodeadonekri'
// version of EOF-data format         12       2    1
// number of volumes                  14       2
// first section header size          16       4
// first section size                 20       4
// 'init' section size                24       4
// reserved                        28-63
//
// All other sections represent volumes with header and data.
// First volume (with index 0) is a bootable (main app module/realm).
//
// header structure ():
//
// description                    offset    size    value (default)
// ------------------------------------------------------------------
// header size                         0       4
// data size                           4       4
// reserved                         8-15
// next section header size           16       4    0
// next section size                  20       4    0
// name/mount point                   24   <var>
// type                            <var>   <var>
// mapping                         <var>   <var>
// index                           <var>   <var>
//

const EOF_SIG = "nodeadonekri";
const EOF_HEADER_SIZE = 64;
const EOF_VERSION = 1;

const writeString = (str, buff, offset) => {
    buff.writeUInt16BE(str.length, offset);
    if (str.length > 0) {
        buff.write(str, offset + 2, str.length);
    }
    return offset + 2 + str.length;
};

export default class EOFBuilder {
    constructor() {
        this.init = Buffer.alloc(0);
        this.volumes = [];
        this.builded = false;
    }

    addInit(data) {
        this.init = data;
    }

    /**
     * Adds volume.
     * 
     * In the finished package name will be used as a path to volume in all fs-methods.
     * For 'adone', 'kri' and 'app' volume names path to volume will be '/adone', '/kri'
     * and '/app' accordingly.
     * 
     * @param {string} name name of volume.
     * @param {buffer} data volume data
     * @param {string} index path to javascript index-file relative to volume base.
     */
    async addVolume({ type, mapping = "", name, volume, index = "", startup = false } = {}) {
        if (!is.string(type) || type.length === 0) {
            throw new error.NotValidException("Invalid volume type");
        }
        
        if (!is.string(name) || name.length === 0) {
            throw new error.NotValidException("Invalid volume name");
        }

        if (!volume || !(is.string(volume) || is.buffer(volume))) {
            throw new error.NotValidException("Invalid volume source data");
        }

        if (!name.startsWith("/")) {
            name = `/${name}`;
        }

        if (startup) {
            for (const vol of this.volumes) {
                if (vol.startup) {
                    throw new error.NotAllowedException("Multiple startup-volumes is not allowed");
                }
            }
        }

        let data;
        if (is.string(volume)) {
            data = await fs.readFile(volume);
        } else if (is.buffer(volume)) {
            data = volume;
        }

        if (data.length < 128) {
            throw new error.NotValidException("Invalid volume source data");
        }

        this.volumes.push({
            type,
            name,
            mapping,
            index,
            data,
            startup
        });
    }

    build(validate = true) {
        if (this.builded) {
            throw new error.IllegalStateException("EOF already builded");
        }

        let hasStatup = false;
        for (let i = 0; i < this.volumes.length; i++) {
            const vol = this.volumes[i];
            if (vol.startup) {
                hasStatup = true;
                if (i !== 0) {
                    [this.volumes[0], this.volumes[i]] = [this.volumes[i], this.volumes[0]];
                }
            }
        }

        if (validate && !hasStatup) {
            throw new error.NotAllowedException("No startup volume");
        }

        const header = Buffer.alloc(EOF_HEADER_SIZE);
        header.write(EOF_SIG, 0);
        header.writeUInt16BE(EOF_VERSION, 12);
        header.writeUInt16BE(this.volumes.length, 14);
        header.writeUInt32BE(0, 16);
        header.writeUInt32BE(0, 20);
        header.writeUInt32BE(Buffer.byteLength(this.init), 24);

        let prevVol;
        for (let i = 0; i < this.volumes.length; i++) {
            const vol = this.volumes[i];
            const hdrSize = 4 + 4 + 4 + 4 + 4 + 4 + 4 * 2 + vol.type.length + vol.name.length + vol.mapping.length + vol.index.length;
            const volHeader = Buffer.allocUnsafe(hdrSize);
            volHeader.writeUInt32BE(hdrSize, 0);
            volHeader.writeUInt32BE(vol.data.length, 4);
            volHeader.writeUInt32BE(0, 8); // reserved
            volHeader.writeUInt32BE(0, 12); // reserved
            volHeader.writeUInt32BE(0, 16);
            volHeader.writeUInt32BE(0, 20);
            let offset = 24;
            offset = writeString(vol.name, volHeader, offset);
            offset = writeString(vol.type, volHeader, offset);
            offset = writeString(vol.mapping, volHeader, offset);
            offset = writeString(vol.index, volHeader, offset);
            vol.header = volHeader;

            if (i === 0) {
                header.writeUInt32BE(vol.header.length, 16);
                header.writeUInt32BE(vol.data.length + vol.header.length, 20);
            } else {
                prevVol.header.writeUInt32BE(vol.header.length, 16);
                prevVol.header.writeUInt32BE(vol.data.length + vol.header.length, 20);
            }
            prevVol = vol;
        }

        this.header = header;

        // Reverse volumes for stream them in correct sequence
        this.volumes.reverse();
        this.builded = true;
    }

    toStream() {
        const readable = new adone.std.stream.Readable({ read() { } });

        for (const vol of this.volumes) {
            readable.push(vol.header);
            readable.push(vol.data);
        }

        readable.push(this.init);
        readable.push(this.header);
        readable.push(null);
        return readable;
    }
}
EOFBuilder.HEADER_SIZE = EOF_HEADER_SIZE;
EOFBuilder.SIG = EOF_SIG;
EOFBuilder.VERSION = EOF_VERSION;
