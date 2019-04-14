/* eslint-disable adone/no-typeof */
import { checkOptions } from "./util";
import AsyncMirror from "./backend/async_mirror";
import FolderAdapter from "./backend/folder_adapter";
import InMemory from "./backend/memory";
import MountableFileSystem from "./backend/mountable";
import OverlayFS from "./backend/overlay";
import ZipFS from "./backend/zip";
// Monkey-patch `Create` functions to check options before file system initialization.
[AsyncMirror, FolderAdapter, InMemory, MountableFileSystem, OverlayFS, ZipFS].forEach((fsType) => {
    const create = fsType.Create;
    fsType.Create = function (opts, cb) {
        const oneArg = typeof (opts) === "function";
        const normalizedCb = oneArg ? opts : cb;
        const normalizedOpts = oneArg ? {} : opts;
        function wrappedCb(e) {
            if (e) {
                normalizedCb(e);
            }
            else {
                create.call(fsType, normalizedOpts, normalizedCb);
            }
        }
        checkOptions(fsType, normalizedOpts, wrappedCb);
    };
});
/**
 * @hidden
 */
const Backends = { AsyncMirror, FolderAdapter, InMemory, MountableFileSystem, OverlayFS, ZipFS };

export default Backends;
