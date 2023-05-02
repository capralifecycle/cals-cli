import pLimit from "p-limit";
import read from "read";
import { getGitHubOrgs } from "../../../definition/definition";
import { cleanupChangeSetItems, createChangeSetItemsForMembers, createChangeSetItemsForProjects, createChangeSetItemsForTeams, } from "../../../github/changeset/changeset";
import { executeChangeSet, isNotImplementedChangeSetItem, } from "../../../github/changeset/execute";
import { createGitHubService } from "../../../github/service";
import { createCacheProvider, createConfig, createReporter, definitionFileOptionName, definitionFileOptionValue, getDefinitionFile, } from "../../util";
import { reportRateLimit } from "./util";
function createOrgGetter(github) {
    const orgs = {};
    // Use a semaphore for each orgName to restrict multiple
    // concurrent requests of the same org.
    const semaphores = {};
    function getSemaphore(orgName) {
        if (!(orgName in semaphores)) {
            semaphores[orgName] = pLimit(1);
        }
        return semaphores[orgName];
    }
    return async function (orgName) {
        return await getSemaphore(orgName)(async () => {
            if (!(orgName in orgs)) {
                const org = await github.getOrg(orgName);
                orgs[orgName] = {
                    org,
                    teams: await github.getTeamList(org),
                };
            }
            return orgs[orgName];
        });
    };
}
async function process(reporter, github, definition, getOrg, execute, limitToOrg) {
    let changes = [];
    for (const orgName of getGitHubOrgs(definition)) {
        if (limitToOrg !== undefined && limitToOrg !== orgName) {
            continue;
        }
        const org = (await getOrg(orgName)).org;
        changes = [
            ...changes,
            ...(await createChangeSetItemsForMembers(github, definition, org)),
        ];
        changes = [
            ...changes,
            ...(await createChangeSetItemsForTeams(github, definition, org)),
        ];
    }
    changes = [
        ...changes,
        ...(await createChangeSetItemsForProjects(github, definition, limitToOrg)),
    ];
    changes = cleanupChangeSetItems(changes);
    const ignored = changes.filter(isNotImplementedChangeSetItem);
    changes = changes.filter((it) => !ignored.includes(it));
    if (ignored.length > 0) {
        reporter.info("Not implemented:");
        for (const change of ignored) {
            reporter.info("  - " + JSON.stringify(change));
        }
    }
    if (changes.length === 0) {
        reporter.info(`No actions to be performed`);
    }
    else {
        reporter.info(`To be performed:`);
        for (const change of changes) {
            reporter.info("  - " + JSON.stringify(change));
        }
    }
    if (execute && changes.length > 0) {
        const cont = await new Promise((resolve, reject) => {
            read({
                prompt: "Confirm you want to execute the changes [y/N]: ",
                timeout: 60000,
            }, (err, answer) => {
                if (err) {
                    reject(err);
                }
                resolve(answer);
            });
        });
        if (cont === "y" || cont === "Y") {
            reporter.info("Executing changes");
            await executeChangeSet(github, changes, reporter);
        }
        else {
            reporter.info("Skipping");
        }
    }
    reporter.info(`Number of GitHub requests: ${github.requestCount}`);
}
const command = {
    command: "configure",
    describe: "Configure CALS GitHub resources",
    builder: (yargs) => yargs
        .options("execute", {
        describe: "Execute the detected changes",
        type: "boolean",
    })
        .options("org", {
        describe: "Filter resources by GitHub organization",
        type: "string",
    })
        .option(definitionFileOptionName, definitionFileOptionValue),
    handler: async (argv) => {
        const reporter = createReporter(argv);
        const config = createConfig();
        const github = await createGitHubService({
            config,
            cache: createCacheProvider(config, argv),
        });
        const definition = await getDefinitionFile(argv).getDefinition();
        await reportRateLimit(reporter, github, async () => {
            const orgGetter = createOrgGetter(github);
            await process(reporter, github, definition, orgGetter, !!argv["execute"], argv["org"]);
        });
    },
};
export default command;
