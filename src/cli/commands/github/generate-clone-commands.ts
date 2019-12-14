import fs from 'fs'
import path from 'path'
import { sprintf } from 'sprintf-js'
import yargs, { CommandModule } from 'yargs'
import {
  createCacheProvider,
  createConfig,
  createReporter,
} from '../../../cli/util'
import { Config } from '../../../config'
import { createGitHubService, GitHubService } from '../../../github/service'
import {
  getGroupedRepos,
  includesTopic,
  isAbandoned,
} from '../../../github/util'
import { Reporter } from '../../reporter'

const generateCloneCommands = async ({
  reporter,
  config,
  github,
  owner,
  ...opt
}: {
  reporter: Reporter
  config: Config
  github: GitHubService
  all: boolean
  excludeExisting: boolean
  group: string | undefined
  includeAbandoned: boolean
  listGroups: boolean
  topic: string | undefined
  owner: string
}) => {
  if (!opt.listGroups && !opt.all && opt.group === undefined) {
    yargs.showHelp()
    return
  }

  const repos = await github.getRepoList({ owner })
  const groups = getGroupedRepos(repos)

  if (opt.listGroups) {
    groups.forEach(it => {
      reporter.log(it.name)
    })
    return
  }

  groups.forEach(group => {
    if (opt.group !== undefined && opt.group !== group.name) {
      return
    }

    group.items
      .filter(it => opt.includeAbandoned || !isAbandoned(it))
      .filter(it => opt.topic === undefined || includesTopic(it, opt.topic))
      .filter(
        it =>
          !opt.excludeExisting ||
          !fs.existsSync(path.resolve(config.cwd, it.name)),
      )
      .forEach(repo => {
        // The output of this is used to pipe into e.g. bash.
        // We cannot use reporter.log as it adds additional characters.
        process.stdout.write(
          sprintf('[ ! -e "%s" ] && git clone %s\n', repo.name, repo.sshUrl),
        )
      })
  })
}

const command: CommandModule = {
  command: 'generate-clone-commands',
  describe: 'Generate shell commands to clone CALS Git repos',
  builder: yargs =>
    yargs
      .positional('group', {
        describe: 'Group to generate commands for',
      })
      .option('all', {
        describe: 'Use all groups',
        type: 'boolean',
      })
      .option('list-groups', {
        alias: 'l',
        describe: 'List available groups',
        type: 'boolean',
      })
      .option('include-abandoned', {
        alias: 'a',
        describe: 'Include repos with abandoned topic',
        type: 'boolean',
      })
      .option('topic', {
        alias: 't',
        describe: 'Filter by specific topic',
        type: 'string',
      })
      .option('exclude-existing', {
        alias: 'x',
        describe: 'Exclude if existing in working directory',
        type: 'boolean',
      }),
  handler: async argv => {
    const config = createConfig()

    return generateCloneCommands({
      reporter: createReporter(argv),
      config,
      github: await createGitHubService(
        config,
        createCacheProvider(config, argv),
      ),
      all: !!argv.all,
      listGroups: !!argv['list-groups'],
      includeAbandoned: !!argv['include-abandoned'],
      topic: argv.topic as string | undefined,
      excludeExisting: !!argv['exclude-existing'],
      group: argv.group as string | undefined,
      owner: argv['org'] as string,
    })
  },
}

export default command
