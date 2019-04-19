kriFs.mountVolumes(__kri__.volumes);
kriFs.patchNative();

process.argv.splice(1, 0, __kri__.main);
require("module").runMain();
