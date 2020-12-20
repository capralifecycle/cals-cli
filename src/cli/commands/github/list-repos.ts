import { CommandModule } from "yargs"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Repo } from "../../../github/types"
import { getGroup, getGroupedRepos, includesTopic } from "../../../github/util"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

function getReposMissingGroup(repos: Repo[]) {
  return repos.filter((it) => getGroup(it) === null)
}

function getOldRepos(repos: Repo[], days: number) {
  const ignoreAfter = new Date()
  ignoreAfter.setDate(ignoreAfter.getDate() - days)

  return repos
    .filter((it) => !it.isArchived)
    .filter((it) => new Date(it.updatedAt) < ignoreAfter)
    .sort((a, b) =>
      a.updatedAt.toString().localeCompare(b.updatedAt.toString()),
    )
}

async function listRepos({
  reporter,
  github,
  includeArchived,
  name = undefined,
  topic = undefined,
  compact,
  csv,
  org,
}: {
  reporter: Reporter
  github: GitHubService
  includeArchived: boolean
  name?: string
  topic?: string
  compact: boolean
  csv: boolean
  org: string
}) {
  let repos = await github.getOrgRepoList({ org })

  if (!includeArchived) {
    repos = repos.filter((it) => !it.isArchived)
  }

  if (name !== undefined) {
    repos = repos.filter((it) => it.name.includes(name))
  }

  if (topic !== undefined) {
    repos = repos.filter((it) => includesTopic(it, topic))
  }

  // All CSV output is done using direct stdout to avoid extra chars.

  if (csv) {
    process.stdout.write("reponame,group\n")
  }

  getGroupedRepos(repos).forEach((group) => {
    if (!csv && compact) {
      reporter.log(`${group.name}`)
    } else if (!csv) {
      reporter.log("")
      reporter.log(`======== ${group.name} ========`)
    }

    group.items.forEach((repo) => {
      if (csv) {
        // We assume we have no repos or group names with a comma in its name.
        process.stdout.write(`${repo.name},${group.name}\n`)
        return
      }

      if (compact) {
        reporter.log(`- ${repo.name}`)
        return
      }

      reporter.log(`${repo.name}`)
      reporter.log(`- Created: ${repo.createdAt}`)
      reporter.log(`- Updated: ${repo.updatedAt}`)

      if (repo.repositoryTopics.edges.length === 0) {
        reporter.log("- Topics: (none)")
      } else {
        reporter.log("- Topics:")
        repo.repositoryTopics.edges.forEach((edge) => {
          reporter.log(`  - ${edge.node.topic.name}`)
        })
      }
    })
  })

  if (csv) {
    return
  }

  reporter.log("")
  reporter.log(`Total number of repos: ${repos.length}`)

  const missingGroup = getReposMissingGroup(repos)
  if (missingGroup.length > 0) {
    reporter.log("")
    reporter.log("Repos missing group/customer topic:")

    missingGroup.forEach((repo) => {
      reporter.log(`- ${repo.name}`)
    })

    reporter.log(
      "Useful search query: https://github.com/capralifecycle?q=topics%3A0",
    )
  }

  const days = 180
  const oldRepos = getOldRepos(repos, days)

  if (oldRepos.length > 0) {
    reporter.log("")
    reporter.log(`Repositories not updated for ${days} days:`)

    oldRepos.forEach((repo) => {
      reporter.log(`- ${repo.name} - ${repo.updatedAt}`)
    })
  }
}

const command: CommandModule = {
  command: "list-repos",
  describe: "List Git repos for a GitHub organization",
  builder: (yargs) =>
    yargs
      .options("org", {
        required: true,
        describe: "Specify GitHub organization",
        type: "string",
      })
      .option("include-archived", {
        alias: "a",
        describe: "Include archived repos",
        type: "boolean",
      })
      .options("compact", {
        alias: "c",
        describe: "Compact output list",
        type: "boolean",
      })
      .options("csv", {
        describe: "Output as a CSV list that can be used for automation",
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
      }),
  handler: async (argv) => {
    const config = createConfig()
    await listRepos({
      reporter: createReporter(argv),
      github: await createGitHubService({
        config,
        cache: createCacheProvider(config, argv),
      }),
      includeArchived: !!argv["include-archived"],
      name: argv.name as string | undefined,
      topic: argv.topic as string | undefined,
      compact: !!argv.compact,
      csv: !!argv.csv,
      org: argv["org"] as string,
    })
  },
}

export default command
