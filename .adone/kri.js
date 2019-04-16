export default {
    configure: [
        "--fully-static",
        "--without-node-options",
        "--without-npm",
        "--without-inspector",
        "--experimental-http-parser",
        //"--release-urlbase="
        ...(adone.is.linux ? ["--enable-lto"] : [])
    ],
    make: [
        "-j8"
    ]
};
