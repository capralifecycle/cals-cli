import { CommandModule } from 'yargs'
import { GitHubService } from '../../../github/service'
import { Repo } from '../../../github/types'
import {
  getGroup,
  getGroupedRepos,
  includesTopic,
  isAbandoned,
} from '../../../github/util'
import { Reporter } from '../../reporter'
import { createReporter } from '../../util'
import { createGitHubService } from '../github'

const getReposMissingGroup = (repos: Repo[]) =>
  repos.filter(it => getGroup(it) === null)

const getOldRepos = (repos: Repo[], days: number) => {
  const ignoreAfter = new Date()
  ignoreAfter.setDate(ignoreAfter.getDate() - days)

  return repos
    .filter(it => !isAbandoned(it))
    .filter(it => new Date(it.updatedAt) < ignoreAfter)
    .sort((a, b) =>
      a.updatedAt.toString().localeCompare(b.updatedAt.toString()),
    )
}

const listRepos = async ({
  reporter,
  github,
  includeAbandoned,
  topic = null,
  compact,
}: {
  reporter: Reporter
  github: GitHubService
  includeAbandoned: boolean
  topic?: string | null
  compact: boolean
}) => {
  let repos = await github.getRepoList({ owner: 'capralifecycle' })

  if (!includeAbandoned) {
    repos = repos.filter(it => !isAbandoned(it))
  }

  if (topic !== null) {
    repos = repos.filter(it => includesTopic(it, topic))
  }

  getGroupedRepos(repos).forEach(group => {
    if (compact) {
      reporter.log(`${group.name}`)
    } else {
      reporter.log('')
      reporter.log(`======== ${group.name} ========`)
    }

    group.items.forEach(repo => {
      if (compact) {
        reporter.log(`- ${repo.name}`)
        return
      }

      reporter.log(`${repo.name}`)
      reporter.log(`- Created: ${repo.createdAt}`)
      reporter.log(`- Updated: ${repo.updatedAt}`)

      if (repo.repositoryTopics.edges.length === 0) {
        reporter.log('- Topics: (none)')
      } else {
        reporter.log('- Topics:')
        repo.repositoryTopics.edges.forEach(edge => {
          reporter.log(`  - ${edge.node.topic.name}`)
        })
      }
    })
  })

  reporter.log('')
  reporter.log(`Total number of repos: ${repos.length}`)

  const missingGroup = getReposMissingGroup(repos)
  if (missingGroup.length > 0) {
    reporter.log('')
    reporter.log('Repos missing group/customer topic:')

    missingGroup.forEach(repo => {
      reporter.log(`- ${repo.name}`)
    })

    reporter.log(
      'Useful search query: https://github.com/capralifecycle?q=topics%3A0',
    )
  }

  const days = 180
  const oldRepos = getOldRepos(repos, days)

  if (oldRepos.length > 0) {
    reporter.log('')
    reporter.log(`Repositories not updated for ${days} days:`)

    oldRepos.forEach(repo => {
      reporter.log(`- ${repo.name} - ${repo.updatedAt}`)
    })
  }
}

const command: CommandModule = {
  command: 'list-repos',
  describe: 'List CALS Git repos',
  builder: yargs =>
    yargs
      .option('include-abandoned', {
        alias: 'a',
        describe: 'Include repos with abandoned topic',
        type: 'boolean',
      })
      .options('compact', {
        alias: 'c',
        describe: 'Compact output list',
        type: 'boolean',
      })
      .option('topic', {
        alias: 't',
        describe: 'Filter by specific topic',
        type: 'string',
      }),
  handler: argv =>
    listRepos({
      reporter: createReporter(),
      github: createGitHubService(),
      includeAbandoned: !!argv['include-abandoned'],
      topic: argv.topic as string | undefined,
      compact: !!argv.compact,
    }),
}

export default command
