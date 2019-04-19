import { SimpleSyncRWTransaction, SyncKeyValueFileSystem } from "../generic/key_value_filesystem";

/**
 * A simple in-memory key-value store backed by a JavaScript object.
 */
export class InMemoryStore {
    constructor() {
        this.store = {};
    }

    name() {
        return MemoryFS.name;
    }

    clear() {
        this.store = {};
    }

    beginTransaction(type) {
        return new SimpleSyncRWTransaction(this);
    }

    get(key) {
        return this.store[key];
    }

    put(key, data, overwrite) {
        if (!overwrite && this.store.hasOwnProperty(key)) {
            return false;
        }
        this.store[key] = data;
        return true;
    }

    del(key) {
        delete this.store[key];
    }
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 */
export default class MemoryFS extends SyncKeyValueFileSystem {
    constructor() {
        super({ store: new InMemoryStore() });
    }

    static create() {
        return new MemoryFS();
    }
}
MemoryFS.options = {};
