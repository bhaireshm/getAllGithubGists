const { resolve, basename, join } = require("path");
const { rm, existsSync, mkdirSync, writeFileSync, readFileSync } = require("fs");
const prompt = require("prompt").start({ noHandleSIGINT: true });

const helperFolderpath = resolve(__dirname, "helper");
const base_url = "https://api.github.com/users";
const headers = { Authorization: "" };
let showLog = false;
let readJSON = true; // * Note: set this false to get the data latest from github. 

const argsSchema = [
    {
        name: "readJSON",
        default: readJSON,
        type: "boolean",
        description: "Read JSON file for Gist Contents?",
    },
    {
        name: "username",
        type: "string",
        default: "bhaireshm",
        required: true,
        description: "Github name",
        message: "Github name cannot be empty",
        // when: () => { readJSON is false execute this }
    },
    {
        name: "token",
        type: "string",
        default: "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",
        required: true,
        description: "Github token",
        message: "Github token cannot be empty",
        // when: () => { readJSON is false execute this }
    },
    {
        name: "log",
        default: showLog,
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

    if (args.rmfiles && existsSync(helperFolderpath))
        rm(helperFolderpath, { recursive: true, force: true }, function (e) { error(e) });

    showLog = Boolean(args.log);
    headers.Authorization = args.token;

    if (showLog) {
        console.log("results", args);
        console.log("header", headers);
    }

    fetchAllGists(args.username);
});

process.on('SIGINT', function () {
    console.log("This will execute when you hit CTRL+C");
    process.exit();
});

function genericFetch(url, options) {
    return fetch(url, { headers, cache: "no-cache", ...options });
}

function fetchAllGists(user) {
    if (readJSON) {
        const data = JSON.parse(readFileSync(join("data", "gists.json"), { encoding: "utf-8" }));
        console.log("file: app.js:81 > fetchAllGists > data", data);
        getAllGistData(data);
    } else {
        genericFetch(`${base_url}/${user}/gists`)
            .then((r) => r.json())
            .then(getAllGistData)
            .catch(error);
    }
}

async function getAllGistData(data) {
    try {
        if (showLog) console.log("data", data);
        if (data?.message) error(data.message);
        let res = [];

        if (readJSON) {
            res = data;
        } else {
            createFiles([{ data: JSON.stringify(data), name: "gistList.json" }], resolve(__dirname, "data"));

            const gistRawURL = data?.map((p) => p.url);
            if (showLog) console.log("gistURL", gistRawURL);

            const promises = gistRawURL?.map((url) =>
                genericFetch(url).then((r) => r.json())
            );
            res = await Promise.all(promises).catch(error);

            if (showLog) console.log("res", res);
            createFiles([{ data: JSON.stringify(res), name: "gists.json" }], resolve(__dirname, "data"));
        }

        const fileData = res
            ?.filter((a) => a)
            .map((p) => {
                return Object.keys(p.files).map((key) => {
                    return {
                        // name: p.files[key].filename,
                        name: key,
                        data: `${p.files[key].content}\n\nmodule.exports = ${basename(key).split(".")[0]};`,
                    };
                });
            })
            .flat();

        if (showLog) console.log("fileData", fileData);

        const publishFileData = fileData.map(f => {
            // * return `export { default * as ${basename(f.name)} } from "./src/helpers/${f.name}";`;
            return `export * from "./src/helpers/${f.name}";`;
        }).join("");

        fileData.push({ data: JSON.stringify(publishFileData), name: 'publish.js' });

        // * Create all the gist files in helper folder
        createFiles(fileData);
    } catch (err) {
        error(err);
    } finally {
        prompt.stop();
    }
}

function createFiles(data, folderPath = helperFolderpath) {
    if (!existsSync(folderPath))
        mkdirSync(folderPath, { recursive: true }, function (e) { e && error(e) });

    const list = [];
    data?.forEach((d) => {
        writeFileSync(resolve(folderPath, d.name), d.data, function (e) {
            if (e) list.push({ name: d.name, status: "FAILED", description: e.message });
        });
        list.push({ name: d.name, status: "CREATED", description: "-" });
    });
    console.table(list);
}

function error(err) {
    throw new Error(err);
}
