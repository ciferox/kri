/* eslint-disable adone/no-typeof */
import { checkOptions } from "./util";
import InMemory from "./backend/memory";
import MountableFileSystem from "./backend/mountable";
import OverlayFS from "./backend/overlay";
import ZipFS from "./backend/zip";

[InMemory, MountableFileSystem, OverlayFS, ZipFS].forEach((fsType) => {
    const create = fsType.create;
    fsType.create = function (opts) {
        checkOptions(fsType, opts);
        return create.call(fsType, opts);
    };
});

export default {
    memory: InMemory,
    mountable: MountableFileSystem,
    overlay: OverlayFS,
    zip: ZipFS
};
