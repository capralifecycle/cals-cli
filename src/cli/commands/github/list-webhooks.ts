import { sprintf } from "sprintf-js"
import { CommandModule } from "yargs"
import { CacheProvider } from "../../../cache"
import { createGitHubService, GitHubService } from "../../../github/service"
import { isAbandoned } from "../../../github/util"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const e = encodeURIComponent

/** @see https://developer.github.com/v3/repos/hooks/#response */
interface Hook {
  name: string
  config: {
    url?: string
    // Undocumented?!
    jenkins_url?: string
  }
  // Undocumented?!
  last_response: {
    code: string
  }
  events: string[]
}

const listWebhooks = async (
  reporter: Reporter,
  cache: CacheProvider,
  github: GitHubService,
  owner: string,
) => {
  const repos = (await github.getRepoList({ owner })).filter(
    it => !isAbandoned(it),
  )

  for (const repo of repos) {
    reporter.log("")
    reporter.log(
      `${repo.name}: https://github.com/capralifecycle/${e(
        repo.name,
      )}/settings/hooks`,
    )

    const hooks = await cache.json(
      `${repo.owner.login}-${repo.name}-hooks`,
      async () =>
        github.runRestGet<Hook[]>(
          `/repos/${e(repo.owner.login)}/${e(repo.name)}/hooks`,
        ),
    )
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
              hook.config.jenkins_url,
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
  describe: "List CALS Git repos web hooks",
  handler: async argv => {
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
