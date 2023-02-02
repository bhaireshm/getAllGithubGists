const { resolve } = require("path");
const { writeFile, rmdir, existsSync, mkdir } = require("fs");
const prompt = require("prompt").start();

const helperFolderpath = resolve(__dirname, "helper");
const base_url = "https://api.github.com/users";
const header = { Authorization: "" };
let showLog = false;
const argsSchema = [
    {
        name: "username",
        type: "string",
        required: true,
        description: "Github name",
        message: "Github name cannot be empty",
    },
    {
        name: "token",
        type: "string",
        required: true,
        description: "Github token",
        message: "Github token cannot be empty",
    },
    {
        name: "log",
        default: false,
        type: "boolean",
        description: "Enable logs?",
    },
    {
        name: "rmfiles",
        default: false,
        type: "boolean",
        description: "Clear helper folder?",
    },
];

prompt.get(argsSchema, function (err, args) {
    if (err) error(err);

    args.username = String(args.username).trim().replace(/ /g, "");
    args.token = args.token;

    if (args.rmfiles)
        rmdir(helperFolderpath, { recursive: true, force: true }, (e) => error(e));

    showLog = Boolean(args.log);
    header.Authorization = args.token;

    if (showLog) {
        console.log("results", args);
        console.log("header", header);
    }

    fetchAllGists(args.username);
});

function genericFetch(url, options) {
    return fetch(url, { header, cache: "no-cache", ...options });
}

function fetchAllGists(user) {
    genericFetch(`${base_url}/${user}/gists`)
        .then((r) => r.json())
        .then(getAllGistData)
        .catch(error);
}

async function getAllGistData(data) {
    try {
        if (showLog) console.log("data", data);
        if (data && data.message) error(data.message);

        const gistRawURL = data?.map((p) => p.url);
        if (showLog) console.log("gistURL", gistRawURL);

        const promises = gistRawURL?.map((url) =>
            genericFetch(url).then((r) => r.json())
        );

        const res = await Promise.all(promises).catch(error);
        if (showLog) console.log("res", res);

        const fileData = res
            ?.filter((a) => a)
            .map((p) => {
                return Object.keys(p.files).map((key) => {
                    return {
                        name: p.files[key].filename,
                        data: p.files[key].content,
                    };
                });
            })
            .flat();

        if (showLog) console.log("fileData", fileData);

        // * Create all the gist files in helper folder
        createFiles(fileData);
    } catch (err) {
        error(err);
    }
}

function createFiles(data) {
    if (!existsSync(helperFolderpath))
        mkdir(helperFolderpath, { recursive: true }, (e) => e && error(e));

    const list = [];
    data?.forEach((d) => {
        writeFile(resolve(helperFolderpath, d.name), d.data, (e) => {
            if (e) list.push({ name: d.name, status: "FAILED", description: e.message });
            list.push({ name: d.name, status: "CREATED", description: "-" });
        });
    });
    console.table(list);
}

function error(err) {
    throw new Error(err);
}
