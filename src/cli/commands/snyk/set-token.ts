import read from 'read'
import { CommandModule } from 'yargs'
import { createSnykService, SnykService } from '../../../snyk/service'
import { Reporter } from '../../reporter'
import { createConfig, createReporter } from '../../util'

const setToken = async ({
  reporter,
  snyk,
  token,
}: {
  reporter: Reporter
  snyk: SnykService
  token: string | undefined
}) => {
  if (token === undefined) {
    reporter.info('Need API token to talk to Snyk')
    reporter.info('See https://app.snyk.io/account')

    token = await new Promise<string>((resolve, reject) => {
      read(
        {
          prompt: 'Enter new Snyk API token: ',
          silent: true,
        },
        (err, answer) => {
          if (err) {
            reject(err)
          }
          resolve(answer)
        },
      )
    })
  }

  snyk.setToken(token)
  reporter.info('Token saved')
}

const command: CommandModule = {
  command: 'set-token',
  describe: 'Set Snyk token for API calls',
  builder: yargs =>
    yargs.positional('token', {
      describe: 'Token. If not provided it will be requested as input',
    }),
  handler: async argv =>
    setToken({
      reporter: createReporter(argv),
      snyk: await createSnykService(createConfig()),
      token: argv.token as string | undefined,
    }),
}

export default command
