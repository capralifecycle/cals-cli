import { sprintf } from "sprintf-js"
import type { CommandModule } from "yargs"
import { createGitHubService, type GitHubService } from "../../../github"
import type { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

async function listPullRequestsStats({
  reporter,
  github,
}: {
  reporter: Reporter
  github: GitHubService
}) {
  // This is only an initial attempt to get some insights into
  // open pull requests. Feel free to change.

  const pulls = await github.getSearchedPullRequestList("capralifecycle")

  interface Category {
    key: string
    old: typeof pulls
    oldSnyk: typeof pulls
    recent: typeof pulls
    recentSnyk: typeof pulls
  }

  const cutoffOld = new Date(Date.now() - 86400 * 1000 * 60)
  const categories = pulls
    .reduce<Category[]>((acc, cur) => {
      const key = `${cur.baseRepository.owner.login}/${cur.baseRepository.name}`
      const old = new Date(cur.createdAt) < cutoffOld
      const snyk = cur.title.includes("[Snyk]")

      // Cheat by mutating.
      let t = acc.find((it) => it.key === key)
      if (t === undefined) {
        t = {
          key,
          old: [],
          oldSnyk: [],
          recent: [],
          recentSnyk: [],
        }
        acc.push(t)
      }

      t[snyk ? (old ? "oldSnyk" : "recentSnyk") : old ? "old" : "recent"].push(
        cur,
      )
      return acc
    }, [])
    .sort((a, b) => a.key.localeCompare(b.key))

  if (categories.length === 0) {
    reporter.log("No pull requests found")
  } else {
    reporter.log("Pull requests stats:")
    reporter.log("A pull request is considered old after 60 days")
    reporter.log("")
    reporter.log(
      sprintf("%-40s %12s %2s %12s %2s", "", "normal", "", "snyk", ""),
    )
    reporter.log(
      sprintf(
        "%-40s %7s %7s %7s %7s",
        "Repo",
        "old",
        "recent",
        "old",
        "recent",
      ),
    )

    categories.forEach((cat) => {
      reporter.log(
        sprintf(
          "%-40s %7s %7s %7s %7s",
          cat.key,
          cat.old.length === 0 ? "" : cat.old.length,
          cat.recent.length === 0 ? "" : cat.recent.length,
          cat.oldSnyk.length === 0 ? "" : cat.oldSnyk.length,
          cat.recentSnyk.length === 0 ? "" : cat.recentSnyk.length,
        ),
      )
    })
  }
}

const command: CommandModule = {
  command: "list-pull-requests-stats",
  describe: "List stats for pull requests with special filter",
  handler: async (argv) => {
    const config = createConfig()
    await listPullRequestsStats({
      reporter: createReporter(argv),
      github: await createGitHubService({
        config,
        cache: createCacheProvider(config, argv),
      }),
    })
  },
}

export default command
