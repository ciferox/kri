export default {
    "realm": {
        "artifactTags": [
            "src",
            "info"
        ]
    },
    "volumes": {
        "/adone": {
            type: "zip",
            input: adone.realm.rootRealm,
            mapping: "adone"
        },
        // "/nativefs": {
        //     type: "fs",
        //     mapping: "nfs"
        // }
    },
    configure: [
        // "--fully-static",
        // "--without-node-options",
        // "--without-npm",
        // "--without-inspector",
        // "--experimental-http-parser",
        //"--release-urlbase="
        // ...(adone.is.linux ? ["--enable-lto"] : [])
    ],
    make: [
        "-j8"
    ]
};
