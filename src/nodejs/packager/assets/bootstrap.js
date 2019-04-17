{
    const internalFs = process.binding("fs");
    const __kri__ = {
        internalPatches: {},
        noopHook(original, ...args) {
            return original.apply(this, args);
        },
        patch(obj, method) {
            const original = obj[method];
            if (!original) {
                return;
            }
            this.internalPatches[method] = this.noopHook;
            obj[method] = function (...args) {
                return __kri__.internalPatches[method].call(this, original, ...args);
            };
        }
    };
    Object.defineProperty(global, "__kri__", {
        value: __kri__
    });
    __kri__.patch(internalFs, "internalModuleReadJSON");
    __kri__.patch(internalFs, "internalModuleStat");
}
