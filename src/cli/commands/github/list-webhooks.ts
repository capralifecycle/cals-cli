import { sprintf } from "sprintf-js"
import { CommandModule } from "yargs"
import { CacheProvider } from "../../../cache"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const e = encodeURIComponent

async function listWebhooks(
  reporter: Reporter,
  cache: CacheProvider,
  github: GitHubService,
  org: string,
) {
  const repos = (await github.getOrgRepoList({ org })).filter(
    (it) => !it.isArchived,
  )

  for (const repo of repos) {
    reporter.log("")
    reporter.log(
      `${repo.name}: https://github.com/capralifecycle/${e(
        repo.name,
      )}/settings/hooks`,
    )

    const hooks = await github.getRepositoryHooks(repo.owner.login, repo.name)
    for (const hook of hooks) {
      if (
        hook.config.url === undefined ||
        !hook.config.url.includes("jenkins")
      ) {
        continue
      }

      switch (hook.name) {
        case "web":
          reporter.log(
            sprintf(
              "    web: %s (%s) (%s)",
              hook.config.url,
              hook.last_response.code,
              hook.events.join(", "),
            ),
          )
          break

        case "jenkinsgit":
          reporter.log(
            sprintf(
              "    jenkinsgit: %s (%s) (%s)",
              // This is undocumented.
              (hook.config as Record<string, string>).jenkins_url,
              hook.last_response.code,
              hook.events.join(", "),
            ),
          )
          break

        case "docker":
          reporter.log(
            sprintf(
              "    docker (%s) (%s)",
              hook.last_response.code,
              hook.events.join(", "),
            ),
          )
          break

        default:
          reporter.log(`  ${hook.name}: <unknown type>`)
          reporter.log(JSON.stringify(hook))
      }
    }
  }
}

const command: CommandModule = {
  command: "list-webhooks",
  describe: "List webhooks for repositories in for a GitHub organization",
  builder: (yargs) =>
    yargs.options("org", {
      required: true,
      describe: "Specify GitHub organization",
      type: "string",
    }),
  handler: async (argv) => {
    const config = createConfig()
    const cacheProvider = createCacheProvider(config, argv)
    await listWebhooks(
      createReporter(argv),
      cacheProvider,
      await createGitHubService(config, cacheProvider),
      argv["org"] as string,
    )
  },
}

export default command
