import { CommandModule } from "yargs"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Repo } from "../../../github/types"
import {
  getGroup,
  getGroupedRepos,
  includesTopic,
  isAbandoned,
} from "../../../github/util"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const getReposMissingGroup = (repos: Repo[]) =>
  repos.filter((it) => getGroup(it) === null)

const getOldRepos = (repos: Repo[], days: number) => {
  const ignoreAfter = new Date()
  ignoreAfter.setDate(ignoreAfter.getDate() - days)

  return repos
    .filter((it) => !isAbandoned(it))
    .filter((it) => new Date(it.updatedAt) < ignoreAfter)
    .sort((a, b) =>
      a.updatedAt.toString().localeCompare(b.updatedAt.toString()),
    )
}

const listRepos = async ({
  reporter,
  github,
  includeAbandoned,
  topic = null,
  compact,
  csv,
  owner,
}: {
  reporter: Reporter
  github: GitHubService
  includeAbandoned: boolean
  topic?: string | null
  compact: boolean
  csv: boolean
  owner: string
}) => {
  let repos = await github.getRepoList({ owner })

  if (!includeAbandoned) {
    repos = repos.filter((it) => !isAbandoned(it))
  }

  if (topic !== null) {
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
  describe: "List CALS Git repos",
  builder: (yargs) =>
    yargs
      .option("include-abandoned", {
        alias: "a",
        describe: "Include repos with abandoned topic",
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
      .option("topic", {
        alias: "t",
        describe: "Filter by specific topic",
        type: "string",
      }),
  handler: async (argv) => {
    const config = createConfig()
    await listRepos({
      reporter: createReporter(argv),
      github: await createGitHubService(
        config,
        createCacheProvider(config, argv),
      ),
      includeAbandoned: !!argv["include-abandoned"],
      topic: argv.topic as string | undefined,
      compact: !!argv.compact,
      csv: !!argv.csv,
      owner: argv["org"] as string,
    })
  },
}

export default command
