const {
    fs,
    std: { path: { join } },
    util: { match }
} = adone;

const {
    fs: kriFs
} = kri;

const defaults = {
    encoding: "utf8",
    strict: false,
    stats: false,
    followSymlinks: true,
    patterns: [],
    match: {
        matchBase: true,
        dot: true,
        nocomment: true
    }
};

const readdirSync = (dir, options) => {
    const { encoding, patterns, strict, stats, followSymlinks, match: matchOptions } = {
        ...defaults,
        ...options
    };

    let results = [];
    let entries = [];

    try {
        if (!patterns.length || (patterns.length && match(dir, patterns, matchOptions).length).length > 0) {
            entries = kriFs.readdirSync(dir, { encoding });
        }
    } catch (err) {
        if (strict) {
            throw err;
        } else {
            results.push({ path: dir, err });
        }
    }

    if (!entries.length) {
        return entries;
    }

    for (const name of entries) {
        const path = join(dir, name);

        if (patterns.length && match(path, patterns, matchOptions).length === 0) {
            continue;
        }

        let s;
        try {
            s = followSymlinks ? kriFs.statSync(path) : kriFs.lstatSync(path);
        } catch (err) {
            if (strict) {
                throw err;
            } else {
                results.push({ path, err });
            }
        }

        if (s) {
            const directory = s.isDirectory();
            const symlink = s.isSymbolicLink();
            const entry = { path, directory, symlink };
            if (stats) {
                entry.stats = s;
            }
            results.push(entry);

            if (directory) {
                results = results.concat(readdirSync(path, options));
            }
        }
    }

    return results;
};

describe("fs", "ZipFS", () => {
    it("traverse all files recursively", async () => {
        const zipPath = join(__dirname, "fixtures", "adone.zip");
        const data = await fs.readFile(zipPath);
        const zipFs = kriFs.backend.zip.create({
            data
        });

        const tmpPath = await fs.tmpName();
        await fs.mkdirp(tmpPath);

        const files = await adone.fast
            .src(zipPath)
            .extract()
            .dest(tmpPath, {
                produceFiles: true
            });

        const expectedFiles = files.map((f) => f.relative);
        
        await fs.rm(tmpPath);

        const mntFs = kriFs.backend.mountable.create({});
        mntFs.mount("/adone", zipFs);
        kriFs.initialize(mntFs);

        const result = readdirSync("/adone");

        assert.sameMembers(result.map((e) => adone.std.path.relative("/adone", e.path)), expectedFiles);
    });

    it("traverse and read all files recursively", async () => {
        const data = await fs.readFile(join(__dirname, "fixtures", "adone.zip"));
        const zipFs = kriFs.backend.zip.create({
            data
        });

        const mntFs = kriFs.backend.mountable.create({});
        mntFs.mount("/adone", zipFs);
        kriFs.initialize(mntFs);

        const result = readdirSync("/adone", { stats: true });

        for (const entry of result) {
            if (!entry.directory) {
                try {
                    kriFs.readFileSync(entry.path);
                } catch (err) {
                    assert.fail(`Error: ${err.message}\nFile: ${entry.path}`);
                }
            }
        }
    });
});
