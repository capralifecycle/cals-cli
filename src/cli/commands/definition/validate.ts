import { CommandModule } from 'yargs'
import { getDefinition } from '../../../definition/definition'
import { createConfig, createReporter } from '../../util'

const command: CommandModule = {
  command: 'validate',
  describe: 'Validate definition file.',
  handler: async () => {
    const reporter = createReporter()
    const config = createConfig()

    getDefinition(config)

    reporter.info('Valid!')
  },
}

export default command
