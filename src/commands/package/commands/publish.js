const {
    cli,
    is,
    app: {
        Subsystem,
        command
    },
    github
} = adone;

export default class extends Subsystem {
    // onConfigure() {
    //     this.nodejsManager = new nodejs.NodejsManager(kri.PACKAGER_CONFIG);
    // }

    @command({
        name: "new",
        description: "Create new KRI release on GitHub",
        arguments: [
            {
                name: "name",
                type: String,
                required: true,
                description: "The name of the release"
            }
        ],
        options: [
            {
                name: "--owner",
                type: String,
                description: "GitHub repository owner"
            },
            {
                name: "--repo",
                type: String,
                description: "GitHub repository name"
            },
            {
                name: ["--tag", "-T"],
                type: String,
                description: "The name of the tag"
            },
            {
                name: "--target-commitish",
                type: String,
                default: "master",
                description: "Specifies the commitish value that determines where the Git tag is created from"
            },
            {
                name: "--body",
                type: String,
                description: "Text describing the contents of the tag"
            },
            {
                name: "--draft",
                description: "Unpublished/draft release"
            },
            {
                name: "--prerelease",
                description: "Prerelease release"
            },
            {
                name: "--api-base",
                type: String,
                default: "https://api.github.com",
                description: "The base GitHub API url"
            }
        ]
    })
    async release(args, opts) {
        try {
            const options = opts.getAll();
            let fullname = options.owner;

            if (options.repo) {
                fullname = `${options.owner}/${options.repo}`;
            }

            // const repo = new github.Repository(fullname, auth, "https://api.github.com");
            // const result = await repo.createRelease({
            //     tag_name: "v1",
            //     name: "Prebuilt KRI (only loader)",
            //     body: "Loader: v1\nEOF: v1",
            //     target_commitish: "current"
            // });

            // console.log(result.data);

            // const res = (await repo.listReleases()).data;
            // console.log(res);

            // await repo.deleteRelease(17025944);
            // await repo.deleteRef("v1");

            // const packager = new kri.packager.NodejsPackager({
            //     input: args.get("input"),
            //     ...opts.getAll(),
            //     manager: this.nodejsManager,
            //     log: (options) => {
            //         if (options.stderr) {
            //             cli.updateProgress({
            //                 status: false,
            //                 clean: true
            //             });
            //             console.error(options.stderr);
            //         } else if (options.stdout) {
            //             if (!is.undefined(options.status) && !is.undefined(options.clean)) {
            //                 cli.updateProgress(options);
            //             }
            //             console.log(options.stdout);
            //         } else {
            //             cli.updateProgress(options);
            //         }
            //     }
            // });

            // await packager.create();

            // cli.updateProgress({
            //     message: "done",
            //     status: true,
            //     // clean: true
            // });

            // console.log(adone.inspect(result, { style: "color" }));

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false,
                clean: true
            });
            console.log(adone.pretty.error(err));
            return 1;
        }
    }
}
