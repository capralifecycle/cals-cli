import { sprintf } from 'sprintf-js'
import { CommandModule } from 'yargs'
import {
  createDetectifyService,
  DetectifyService,
} from '../../../detectify/service'
import { Reporter } from '../../reporter'
import { createConfig, createReporter } from '../../util'

async function report({
  reporter,
  detectify,
}: {
  reporter: Reporter
  detectify: DetectifyService
}) {
  reporter.info('Listing Detectify profiles with latest report')
  const profiles = await detectify.getScanProfiles()

  for (const profile of profiles) {
    reporter.info('')
    reporter.info(sprintf('Project: %s', profile.name))
    reporter.info(sprintf('Endpoint: %s', profile.endpoint))
    const report = await detectify.getScanReportLatest(profile.token)
    if (report !== null) {
      reporter.info(sprintf('Score: %g', report.cvss))
    } else {
      reporter.warn('No report present')
    }
  }
}

const command: CommandModule = {
  command: 'report',
  describe: 'Report Detectify status',
  handler: async () =>
    report({
      reporter: createReporter(),
      detectify: await createDetectifyService(createConfig()),
    }),
}

export default command
