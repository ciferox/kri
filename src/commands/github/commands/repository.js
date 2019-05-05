const {
    cli,
    is,
    app: {
        Subsystem,
        command
    },
    github
} = adone;

const commonOptions = [
    {
        name: "--owner",
        type: String,
        required: true,
        description: "GitHub repository owner"
    },
    {
        name: "--repo",
        type: String,
        required: true,
        description: "GitHub repository name"
    },
    {
        name: "--auth",
        type: String,
        description: "Auth value `username:password` or `token`"
    }
];

export default class extends Subsystem {
    @command({
        name: "createRelease",
        description: "Create a new release",
        options: [
            ...commonOptions,
            {
                name: "--name",
                type: String,
                description: "The name of the release"
            },
            {
                name: ["--tag", "-T"],
                type: String,
                required: true,
                description: "The name of the tag"
            },
            {
                name: "--target-commitish",
                type: String,
                default: "master",
                description: "Commitish value that determines where the Git tag is created from"
            },
            {
                name: "--body",
                type: String,
                default: "",
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
    async createRelease(args, opts) {
        try {
            const options = opts.getAll();
            const { repo } = this._getRepo(options);

            cli.updateProgress({
                message: "processing"
            });

            const result = await repo.createRelease({
                tag_name: options.tag,
                name: options.name,
                body: options.body,
                target_commitish: options.targetCommitish,
                draft: options.draft,
                prerelease: options.prerelease
            });

            cli.updateProgress({
                message: "done",
                status: true,
                clean: true
            });

            console.log(adone.pretty.json(adone.util.pick(result.data, ["id", "url", "assets_url", "html_url", "upload_url"])));

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "deleteRelease",
        description: "Delete a release",
        options: [
            ...commonOptions,
            {
                name: "--id",
                type: String,
                required: true,
                description: "Release id to be deleted"
            }
        ]
    })
    async deleteRelease(args, opts) {
        try {
            const options = opts.getAll();
            const { repo } = this._getRepo(options);

            cli.updateProgress({
                message: "processing"
            });

            const result = await repo.deleteRelease(options.id);

            cli.updateProgress({
                message: "done",
                status: true
            });

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "listReleases",
        description: "Get information about all releases",
        options: [
            ...commonOptions,
            {
                name: "--raw",
                description: "Show raw result"
            }
        ]
    })
    async listReleases(args, opts) {
        try {
            const options = opts.getAll();
            const { repo } = this._getRepo(options);

            cli.updateProgress({
                message: "processing"
            });

            const result = await repo.listReleases();

            cli.updateProgress({
                message: "done",
                status: true,
                clean: true
            });

            if (options.raw) {
                console.log(adone.inspect(result.data, { style: "color", depth: 8 }));
            } else {
                console.log(adone.pretty.json(result.data.map((rel) => adone.util.pick(rel, ["id", "url", "assets_url", "html_url", "upload_url", "tag_name", "name", "draft", "prerelease", "created_at", "target_commitish"]))));
            }

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "listProjects",
        description: "Get information about all projects",
        options: [
            ...commonOptions,
            {
                name: "--raw",
                description: "Show raw result"
            }
        ]
    })
    async listProjects(args, opts) {
        try {
            const options = opts.getAll();
            const { repo } = this._getRepo(options);

            cli.updateProgress({
                message: "processing"
            });

            const result = await repo.listProjects();

            cli.updateProgress({
                message: "done",
                status: true,
                clean: true
            });

            // if (options.raw) {
            console.log(result.data);
            // } else {
            //     console.log(adone.pretty.json(result.data.map((rel) => adone.util.pick(rel, ["id", "url", "assets_url", "html_url", "tag_name", "name", "draft", "prerelease", "created_at", "target_commitish"]))));
            // }

            return 0;
        } catch (err) {
            cli.updateProgress({
                message: err.message,
                status: false
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "uploadAsset",
        description: "Upload a release asset",
        arguments: [
            {
                name: "path",
                type: String,
                required: true,
                description: "Path to file for upload"
            }
        ],
        options: [
            ...commonOptions,
            {
                name: ["--tag", "-T"],
                type: String,
                required: true,
                description: "The name of the tag"
            },
            {
                name: ["--name", "-N"],
                type: String,
                required: true,
                description: "The file name of the asset"
            }
        ]
    })
    async uploadAsset(args, opts) {
        let bar;
        try {
            const options = opts.getAll();
            const { repo, token } = this._getRepo(options);

            if (!token) {
                throw new adone.error.NotValidException("Invalid auth token");
            }

            let result = await repo.listReleases();

            const releaseInfo = result.data.find((rel) => rel.tag_name === options.tag);

            if (is.undefined(releaseInfo)) {
                throw new adone.error.NotFoundException(`Release for '${options.tag}' tag not found`);
            }

            const uploadUrl = `${releaseInfo.upload_url.replace(/({.+})$/, "")}?name=${options.name}`;

            const filePath = adone.path.resolve(args.get("path"));
            // const fileName = adone.path.basename(filePath);
            const stats = await adone.fs.stat(filePath);

            cli.updateProgress({
                message: "uploading"
            });

            result = await adone.http.client.request.post(uploadUrl, adone.fs.createReadStream(filePath), {
                maxContentLength: stats.size,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Length": stats.size,
                    Authorization: `token ${token}`
                },
                rejectUnauthorized: false
            });

            cli.updateProgress({
                message: "done",
                status: true,
                clean: true
            });
            console.log(adone.pretty.json(adone.util.pick(result.data, ["id", "url", "browser_download_url"])));

            return 0;
        } catch (err) {
            if (bar) {
                bar.destroy();
            }
            cli.updateProgress({
                message: err.message,
                status: false,
                // clean: true
            });
            // console.log(adone.pretty.error(err));
            return 1;
        }
    }

    @command({
        name: "deleteAsset",
        description: "Delete a release asset",
        options: [
            ...commonOptions,
            {
                name: ["--tag", "-T"],
                type: String,
                required: true,
                description: "The name of the tag"
            },
            {
                name: "--id",
                type: String,
                required: true,
                description: "Asset id"
            }
        ]
    })
    deleteAsset() {
        // TODO
    }

    _getRepo(options) {
        let auth = (process.env.GITHUB_AUTH || options.auth).trim();
        if (auth) {
            if (auth.includes(":")) {
                const parts = auth.split(":");
                auth = {
                    username: parts[0],
                    password: parts[1]
                };
            } else {
                auth = {
                    token: auth
                };
            }
        } else {
            throw new adone.error.NotValidException("Provide auth using '--auth' option or through GITHUB_AUTH environment variable");
        }

        const fullname = `${options.owner}/${options.repo}`;
        return {
            repo: new github.Repository(fullname, auth, options.apiBase),
            token: auth.token
        };
    }
}
