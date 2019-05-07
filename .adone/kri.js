export default {
    "realm": {
        "artifactTags": [
            "src",
            "info"
        ]
    },
    "fs": {
        // redirect kri realm dirs to real filesystem
        redirects: {
            "/kri/etc": "{kri.home}/etc",
            "/kri/opt": "{kri.home}/opt",
            "/kri/run": "{kri.home}/run",
            "/kri/tmp": "{kri.home}/tmp",
            "/kri/var": "{kri.home}/var"
        }
    },
    "volumes": {
        "/adone": {
            type: "zip",
            input: adone.realm.rootRealm,
            mapping: "adone",
            startup: false
        },
        "/kri": {
            type: "zip",
            input: kri.realm,
            mapping: "kri",
            startup: true
        }
    },

    configure: [
        "--fully-static",
        // "--without-node-options",
        // "--without-npm",
        // "--without-inspector",
        "--experimental-http-parser",
        //"--release-urlbase="
        ...(adone.is.linux ? ["--enable-lto"] : [])
    ],
    make: [
        "-j8"
    ]
};
