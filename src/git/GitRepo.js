import execa from "execa";
import fs from "fs";
import path from "path";
import { getUpdateRange, parseShortlogSummary, wasUpdated } from "./util";
export var CloneType;
(function (CloneType) {
    CloneType[CloneType["HTTPS"] = 0] = "HTTPS";
    CloneType[CloneType["SSH"] = 1] = "SSH";
})(CloneType || (CloneType = {}));
export class GitRepo {
    path;
    logCommand;
    constructor(path, logCommand) {
        this.path = path;
        this.logCommand = logCommand;
    }
    async cloneGitHubRepo(org, name, cloneType) {
        const parent = path.dirname(this.path);
        if (!fs.existsSync(parent)) {
            await fs.promises.mkdir(parent, { recursive: true });
        }
        const cloneUrl = cloneType === CloneType.SSH
            ? `git@github.com:${org}/${name}.git`
            : `https://github.com/${org}/${name}.git`;
        try {
            const result = await execa("git", ["clone", cloneUrl, this.path], {
                cwd: parent,
            });
            await this.logCommand(result);
        }
        catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            await this.logCommand(e);
            throw e;
        }
    }
    async git(args) {
        try {
            const result = await execa("git", args, {
                cwd: this.path,
            });
            await this.logCommand(result);
            return result;
        }
        catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            await this.logCommand(e);
            throw e;
        }
    }
    async getCurrentBranch() {
        return (await this.git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout;
    }
    async hasChangesInProgress() {
        const result = await this.git(["status", "--short"]);
        // Ignore untracked files.
        return result.stdout.replace(/^\?\?.+$/gm, "").length > 0;
    }
    async hasUnpushedCommits() {
        const result = await this.git(["status", "-sb"]);
        return result.stdout.includes("[ahead");
    }
    async getAuthorsForRange(range) {
        const result = await this.git([
            "shortlog",
            "-s",
            `${range.from}..${range.to}`,
        ]);
        return parseShortlogSummary(result.stdout);
    }
    async update() {
        const fetchOnly = async () => {
            await this.git(["fetch"]);
            return {
                updated: false,
                dirty: true,
            };
        };
        if (await this.hasChangesInProgress()) {
            return fetchOnly();
        }
        // TODO: Should have an option if we want to switch branch or not.
        if ((await this.getCurrentBranch()) !== "master") {
            return fetchOnly();
        }
        // TODO: Report which dirs we change branches for.
        // await execa("git", ["checkout", "master"], {
        //   cwd: path,
        // })
        const result = await this.git(["pull", "--rebase"]);
        return {
            dirty: false,
            updated: wasUpdated(result.stdout),
            updatedRange: getUpdateRange(result.stdout) ?? undefined,
        };
    }
}
