import yargs, { CommandModule } from 'yargs'
import setToken from './snyk/set-token'
import sync from './snyk/sync'

const command: CommandModule = {
  command: 'snyk',
  describe: 'Integration with Snyk',
  builder: yargs =>
    yargs
      .command(setToken)
      .command(sync)
      .demandCommand().usage(`cals snyk

Notes:
  Before doing anything against Snyk you need to configure a token
  used for authentication. The following command will ask for a token
  and provide a link to generate one:
  $ cals snyk set-token`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
