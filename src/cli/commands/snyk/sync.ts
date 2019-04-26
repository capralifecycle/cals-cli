import { CommandModule } from 'yargs'
import { getDefinition } from '../../../github/definition'
import { createGitHubService, GitHubService } from '../../../github/service'
import { createSnykService, SnykService } from '../../../snyk/service'
import { SnykGitHubRepo } from '../../../snyk/types'
import { getGitHubRepo } from '../../../snyk/util'
import { Reporter } from '../../reporter'
import { createConfig, createReporter } from '../../util'

const sync = async ({
  reporter,
  snyk,
  github,
}: {
  reporter: Reporter
  snyk: SnykService
  github: GitHubService
}) => {
  const knownRepos = (await snyk.getProjects())
    .map(it => getGitHubRepo(it))
    .filter((it): it is SnykGitHubRepo => it !== undefined)

  const allReposWithSnyk = getDefinition(github)
    .projects.flatMap(project =>
      project.repos.map(repo => ({
        project,
        repo,
      })),
    )
    .filter(it => it.repo.snyk === true)

  const allReposWithSnykStr = allReposWithSnyk.map(
    it => `capralifecycle/${it.repo.name}`,
  )

  const missingInSnyk = allReposWithSnyk.filter(
    it =>
      !knownRepos.some(
        r => r.owner === 'capralifecycle' && r.name === it.repo.name,
      ),
  )

  const extraInSnyk = knownRepos
    .filter(it => it.owner === 'capralifecycle')
    .filter(it => !allReposWithSnykStr.includes(`${it.owner}/${it.name}`))

  if (missingInSnyk.length === 0) {
    reporter.info('All seems fine')
  } else {
    missingInSnyk.forEach(it => {
      reporter.info(`Not in Snyk: ${it.project.name} / ${it.repo.name}`)
    })
    extraInSnyk.forEach(it => {
      reporter.info(`Should not be in Snyk? ${it.owner}/${it.name}`)
    })
  }
}

const command: CommandModule = {
  command: 'sync',
  describe: 'Sync Snyk projects (currently only reports, no automation)',
  handler: async () =>
    sync({
      reporter: createReporter(),
      snyk: await createSnykService(createConfig()),
      github: await createGitHubService(createConfig()),
    }),
}

export default command
