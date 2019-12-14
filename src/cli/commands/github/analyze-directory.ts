import fs from 'fs'
import path from 'path'
import { sprintf } from 'sprintf-js'
import { CommandModule } from 'yargs'
import { Reporter } from '../../../cli/reporter'
import {
  createCacheProvider,
  createConfig,
  createReporter,
} from '../../../cli/util'
import { Config } from '../../../config'
import { createGitHubService, GitHubService } from '../../../github/service'
import { Repo } from '../../../github/types'
import { isAbandoned } from '../../../github/util'

const analyzeDirectory = async (
  reporter: Reporter,
  config: Config,
  github: GitHubService,
  owner: string,
) => {
  const repos = await github.getRepoList({ owner })

  const reposDict = repos.reduce<{
    [key: string]: Repo
  }>((acc, cur) => ({ ...acc, [cur.name]: cur }), {})

  const dirs = fs
    .readdirSync(config.cwd)
    .filter(it => fs.statSync(path.join(config.cwd, it)).isDirectory())
    // Skip hidden folders
    .filter(it => !it.startsWith('.'))
    .sort((a, b) => a.localeCompare(b))

  const stats = {
    unknown: 0,
    abandoned: 0,
    ok: 0,
  }

  dirs.forEach(it => {
    if (!(it in reposDict)) {
      reporter.warn(
        sprintf(
          '%-30s  <-- Not found in repository list (maybe changed name?)',
          it,
        ),
      )
      stats.unknown++
      return
    }

    if (isAbandoned(reposDict[it])) {
      reporter.info(sprintf('%-30s  <-- Marked as abandoned', it))
      stats.abandoned++
      return
    }

    stats.ok += 1
  })

  reporter.info(
    sprintf(
      'Stats: unknown=%d  abandoned=%d  ok=%d',
      stats.unknown,
      stats.abandoned,
      stats.ok,
    ),
  )

  reporter.info(
    'Use `cals github generate-clone-commands` to check for repositories not checked out',
  )
}

const command: CommandModule = {
  command: 'analyze-directory',
  describe: 'Analyze directory for git repos',
  handler: async argv => {
    const config = createConfig()
    const github = await createGitHubService(
      config,
      createCacheProvider(config, argv),
    )
    const reporter = createReporter(argv)
    return analyzeDirectory(reporter, config, github, argv['org'] as string)
  },
}

export default command
