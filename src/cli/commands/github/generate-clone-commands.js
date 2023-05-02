import fs from "fs";
import path from "path";
import { sprintf } from "sprintf-js";
import yargs from "yargs";
import { createCacheProvider, createConfig, createReporter, } from "../../../cli/util";
import { createGitHubService } from "../../../github/service";
import { getGroupedRepos, includesTopic } from "../../../github/util";
async function generateCloneCommands({ reporter, config, github, org, ...opt }) {
    if (!opt.listGroups && !opt.all && opt.group === undefined) {
        yargs.showHelp();
        return;
    }
    const repos = await github.getOrgRepoList({ org });
    const groups = getGroupedRepos(repos);
    if (opt.listGroups) {
        groups.forEach((it) => {
            reporter.log(it.name);
        });
        return;
    }
    groups.forEach((group) => {
        if (opt.group !== undefined && opt.group !== group.name) {
            return;
        }
        group.items
            .filter((it) => opt.includeArchived || !it.isArchived)
            .filter((it) => opt.name === undefined || it.name.includes(opt.name))
            .filter((it) => opt.topic === undefined || includesTopic(it, opt.topic))
            .filter((it) => !opt.excludeExisting ||
            !fs.existsSync(path.resolve(config.cwd, it.name)))
            .forEach((repo) => {
            // The output of this is used to pipe into e.g. bash.
            // We cannot use reporter.log as it adds additional characters.
            process.stdout.write(sprintf('[ ! -e "%s" ] && git clone %s\n', repo.name, repo.sshUrl));
        });
    });
}
const command = {
    command: "generate-clone-commands",
    describe: "Generate shell commands to clone GitHub repos for an organization",
    builder: (yargs) => yargs
        .positional("group", {
        describe: "Group to generate commands for",
    })
        .options("org", {
        required: true,
        describe: "Specify GitHub organization",
        type: "string",
    })
        .option("all", {
        describe: "Use all groups",
        type: "boolean",
    })
        .option("list-groups", {
        alias: "l",
        describe: "List available groups",
        type: "boolean",
    })
        .option("include-archived", {
        alias: "a",
        describe: "Include archived repos",
        type: "boolean",
    })
        .option("name", {
        describe: "Filter to include the specified name",
        type: "string",
    })
        .option("topic", {
        alias: "t",
        describe: "Filter by specific topic",
        type: "string",
    })
        .option("exclude-existing", {
        alias: "x",
        describe: "Exclude if existing in working directory",
        type: "boolean",
    }),
    handler: async (argv) => {
        const config = createConfig();
        return generateCloneCommands({
            reporter: createReporter(argv),
            config,
            github: await createGitHubService({
                config,
                cache: createCacheProvider(config, argv),
            }),
            all: !!argv.all,
            listGroups: !!argv["list-groups"],
            includeArchived: !!argv["include-archived"],
            name: argv.name,
            topic: argv.topic,
            excludeExisting: !!argv["exclude-existing"],
            group: argv.group,
            org: argv["org"],
        });
    },
};
export default command;
