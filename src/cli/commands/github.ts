import yargs, { CommandModule } from 'yargs'
import analyzeDirectory from './github/analyze-directory'
import configure from './github/configure'
import generateCloneCommands from './github/generate-clone-commands'
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
      .command(listRepos)
      .command(listWebhooks)
      .command(setToken)
      .demandCommand(),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
