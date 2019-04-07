import { CommandModule } from 'yargs'
import { createReporter } from '../../cli/util'

const command: CommandModule = {
  command: 'getting-started',
  describe: 'Getting started',
  handler: () => {
    const reporter = createReporter()
    reporter.log(
      'For getting started, see https://confluence.capraconsulting.no/x/cgGzBg',
    )
  },
}

export default command
