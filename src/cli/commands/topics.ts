import type { CommandModule } from "yargs"
import { createGitHubService } from "../../github"
import { createCacheProvider, createConfig, createReporter } from "../util"

const command: CommandModule = {
  command: "topics",
  describe: "List customer topics in a GitHub organization",
  builder: (yargs) =>
    yargs.options("org", {
      alias: "o",
      default: "capralifecycle",
      requiresArg: true,
      describe: "GitHub organization",
      type: "string",
    }),
  handler: async (argv) => {
    const config = createConfig()
    const reporter = createReporter()
    const github = await createGitHubService({
      cache: createCacheProvider(config, argv),
    })

    reporter.status(`Fetching repositories from ${argv.org}...`)
    const repos = await github.getOrgRepoList({ org: argv.org as string })

    const topics = new Set<string>()
    for (const repo of repos) {
      for (const edge of repo.repositoryTopics.edges) {
        const name = edge.node.topic.name
        if (name.startsWith("customer-")) {
          topics.add(name)
        }
      }
    }

    const sorted = [...topics].sort((a, b) => a.localeCompare(b))
    for (const topic of sorted) {
      reporter.log(topic)
    }
  },
}

export default command
