/* eslint-disable adone/no-typeof */
import { checkOptions } from "./util";
import NativeFS from "./backends/native";
import MemoryFS from "./backends/memory";
import MountableFS from "./backends/mountable";
import OverlayFS from "./backends/overlay";
import ZipFS from "./backends/zip";

[NativeFS, MemoryFS, MountableFS, OverlayFS, ZipFS].forEach((fsType) => {
    const create = fsType.create;
    fsType.create = function (opts) {
        checkOptions(fsType, opts);
        return create.call(fsType, opts);
    };
});

export default {
    native: NativeFS,
    memory: MemoryFS,
    mountable: MountableFS,
    overlay: OverlayFS,
    zip: ZipFS
};
