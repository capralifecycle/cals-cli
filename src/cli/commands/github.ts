import yargs, { CommandModule } from 'yargs'
import analyzeDirectory from './github/analyze-directory'
import configure from './github/configure'
import generateCloneCommands from './github/generate-clone-commands'
import listPullRequestsStats from './github/list-pull-requests-stats'
import listRepos from './github/list-repos'
import listWebhooks from './github/list-webhooks'
import setToken from './github/set-token'

const command: CommandModule = {
  command: 'github',
  describe: 'Integration with GitHub',
  builder: yargs =>
    yargs
      .command(analyzeDirectory)
      .command(configure)
      .command(generateCloneCommands)
      .command(listPullRequestsStats)
      .command(listRepos)
      .command(listWebhooks)
      .command(setToken)
      .options('org', {
        default: 'capralifecycle',
        describe: 'Specify GitHub organization',
        type: 'string',
      })
      .demandCommand().usage(`cals github

Notes:
  Before doing anything against GitHub you need to configure a token
  used for authentication. The following command will ask for a token
  and provide a link to generate one:
  $ cals github set-token

  Quick clone all repos:
  $ cals github generate-clone-commands --all -x | bash

  And for a specific project:
  $ cals github generate-clone-commands -x buildtools | bash

  Keeping up to date with removed/renamed repos:
  $ cals github analyze-directory

  Some responses are cached for some time. Wipe the cals-cli
  cache folder in your users cache dir (~/.cache/cals-cli on Linux)
  to invalidate cache.`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
