import type { CommandModule } from "yargs"
import { createGitHubService } from "../../github"
import { getGroupedRepos } from "../../github/util"
import { createCacheProvider, createConfig, createReporter } from "../util"

const command: CommandModule = {
  command: "groups",
  describe: "List available repository groups in a GitHub organization",
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

    const repos = await github.getOrgRepoList({ org: argv.org as string })
    const groups = getGroupedRepos(repos)

    for (const group of groups) {
      reporter.log(group.name)
    }
  },
}

export default command
