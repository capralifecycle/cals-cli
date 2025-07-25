import pLimit from "p-limit"
import { read } from "read"
import type { CommandModule } from "yargs"
import { type Definition, getGitHubOrgs } from "../../../definition"
import {
  cleanupChangeSetItems,
  createChangeSetItemsForMembers,
  createChangeSetItemsForProjects,
  createChangeSetItemsForTeams,
} from "../../../github/changeset/changeset"
import {
  executeChangeSet,
  isNotImplementedChangeSetItem,
} from "../../../github/changeset/execute"
import type { ChangeSetItem } from "../../../github/changeset/types"
import {
  createGitHubService,
  type GitHubService,
} from "../../../github/service"
import type {
  OrgsGetResponse,
  TeamsListResponseItem,
} from "../../../github/types"
import type { Reporter } from "../../reporter"
import {
  createCacheProvider,
  createConfig,
  createReporter,
  definitionFileOptionName,
  definitionFileOptionValue,
  getDefinitionFile,
} from "../../util"
import { reportRateLimit } from "./util"

function createOrgGetter(github: GitHubService) {
  const orgs: {
    [name: string]: {
      org: OrgsGetResponse
      teams: TeamsListResponseItem[]
    }
  } = {}

  // Use a semaphore for each orgName to restrict multiple
  // concurrent requests of the same org.
  const semaphores: Record<string, ReturnType<typeof pLimit>> = {}

  function getSemaphore(orgName: string) {
    if (!(orgName in semaphores)) {
      semaphores[orgName] = pLimit(1)
    }
    return semaphores[orgName]
  }

  return async (orgName: string) =>
    await getSemaphore(orgName)(async () => {
      if (!(orgName in orgs)) {
        const org = await github.getOrg(orgName)
        orgs[orgName] = {
          org,
          teams: await github.getTeamList(org),
        }
      }
      return orgs[orgName]
    })
}

async function process(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
  getOrg: ReturnType<typeof createOrgGetter>,
  execute: boolean,
  limitToOrg: string | undefined,
) {
  let changes: ChangeSetItem[] = []

  for (const orgName of getGitHubOrgs(definition)) {
    if (limitToOrg !== undefined && limitToOrg !== orgName) {
      continue
    }

    const org = (await getOrg(orgName)).org

    changes = [
      ...changes,
      ...(await createChangeSetItemsForMembers(github, definition, org)),
    ]

    changes = [
      ...changes,
      ...(await createChangeSetItemsForTeams(github, definition, org)),
    ]
  }

  changes = [
    ...changes,
    ...(await createChangeSetItemsForProjects(github, definition, limitToOrg)),
  ]

  changes = cleanupChangeSetItems(changes)

  const ignored: ChangeSetItem[] = changes.filter(isNotImplementedChangeSetItem)
  changes = changes.filter((it) => !ignored.includes(it))

  if (ignored.length > 0) {
    reporter.info("Not implemented:")
    for (const change of ignored) {
      reporter.info(`  - ${JSON.stringify(change)}`)
    }
  }

  if (changes.length === 0) {
    reporter.info("No actions to be performed")
  } else {
    reporter.info("To be performed:")
    for (const change of changes) {
      reporter.info(`  - ${JSON.stringify(change)}`)
    }
  }

  if (execute && changes.length > 0) {
    const answer: string = await read({
      prompt: "Confirm you want to execute the changes [y/N]: ",
      timeout: 60000,
    })

    if (answer.toLowerCase() === "y") {
      reporter.info("Executing changes")
      await executeChangeSet(github, changes, reporter)
    } else {
      reporter.info("Skipping")
    }
  }

  reporter.info(`Number of GitHub requests: ${github.requestCount}`)
}

const command: CommandModule = {
  command: "configure",
  describe: "Configure CALS GitHub resources",
  builder: (yargs) =>
    yargs
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
    const reporter = createReporter(argv)
    const config = createConfig()
    const github = await createGitHubService({
      config,
      cache: createCacheProvider(config, argv),
    })
    const definition = await getDefinitionFile(argv).getDefinition()

    await reportRateLimit(reporter, github, async () => {
      const orgGetter = createOrgGetter(github)

      await process(
        reporter,
        github,
        definition,
        orgGetter,
        !!argv.execute,
        argv.org as string | undefined,
      )
    })
  },
}

export default command
