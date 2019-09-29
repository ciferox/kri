/**
 * eslint-disable func-style
 */
const child_process = require("child_process");
const rpc = require("./rpc");

async function spawn(fileName, ...args) {
    const child = child_process.fork(fileName, [], {
        detached: true, stdio: [0, 1, 2, "ipc"]
    });

    const transport = (receivedFromChild) => {
        child.on("message", receivedFromChild);
        return child.send.bind(child);
    };
    const { result } = await rpc.createWorld(transport, ...args);
    return result;
}

function init(initializer) {
    const transport = (receivedFromParent) => {
        process.on("message", receivedFromParent);
        return process.send.bind(process);
    };
    rpc.initWorld(transport, initializer);
}

module.exports = { spawn, init };
