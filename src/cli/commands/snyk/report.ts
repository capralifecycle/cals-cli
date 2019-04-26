import { groupBy, repeat, sortBy, sumBy } from 'lodash'
import { sprintf } from 'sprintf-js'
import { CommandModule } from 'yargs'
import { getDefinition } from '../../../github/definition'
import { createGitHubService, GitHubService } from '../../../github/service'
import { DefinitionRepo, Project } from '../../../github/types'
import { createSnykService, SnykService } from '../../../snyk/service'
import { SnykProject } from '../../../snyk/types'
import { getGitHubRepo, getGitHubRepoId } from '../../../snyk/util'
import { Reporter } from '../../reporter'
import { createConfig, createReporter } from '../../util'

function totalSeverityCount(project: SnykProject) {
  return (
    project.issueCountsBySeverity.high +
    project.issueCountsBySeverity.medium +
    project.issueCountsBySeverity.low
  )
}

function getId(repo: DefinitionRepo) {
  return `capralifecycle/${repo.name}`
}

function buildStatsLine(stats: SnykProject['issueCountsBySeverity']) {
  function item(num: number, str: string) {
    return num === 0 ? repeat(' ', str.length + 4) : sprintf('%3d %s', num, str)
  }

  return sprintf(
    '%s  %s  %s',
    item(stats.high, 'high'),
    item(stats.medium, 'medium'),
    item(stats.low, 'low'),
  )
}

async function report({
  reporter,
  snyk,
  github,
}: {
  reporter: Reporter
  snyk: SnykService
  github: GitHubService
}) {
  const reposWithIssues = (await snyk.getProjects()).filter(
    it => totalSeverityCount(it) > 0,
  )

  const definitionRepos = getDefinition(github).projects.flatMap(project =>
    project.repos.map(repo => ({
      id: getId(repo),
      project,
      repo,
    })),
  )

  function getProject(p: SnykProject) {
    const id = getGitHubRepoId(getGitHubRepo(p))
    const def =
      id === undefined ? undefined : definitionRepos.find(it => it.id === id)
    return def === undefined ? undefined : def.project
  }

  const enhancedRepos = reposWithIssues.map(repo => ({
    repo,
    project: getProject(repo),
  }))

  function getProjectName(project: Project | undefined) {
    return project ? project.name : 'unknown project'
  }

  const byProjects = sortBy(
    Object.values(
      groupBy(enhancedRepos, it => (it.project ? it.project.name : 'unknown')),
    ),
    it => getProjectName(it[0].project),
  )

  if (byProjects.length === 0) {
    reporter.info('No issues found')
  } else {
    reporter.info(
      sprintf(
        '%-70s %s',
        'Total count',
        buildStatsLine({
          high: sumBy(reposWithIssues, it => it.issueCountsBySeverity.high),
          medium: sumBy(reposWithIssues, it => it.issueCountsBySeverity.medium),
          low: sumBy(reposWithIssues, it => it.issueCountsBySeverity.low),
        }),
      ),
    )

    reporter.info('Issues by project:')
    byProjects.forEach(repos => {
      const project = repos[0].project
      const totalCount = {
        high: sumBy(repos, it => it.repo.issueCountsBySeverity.high),
        medium: sumBy(repos, it => it.repo.issueCountsBySeverity.medium),
        low: sumBy(repos, it => it.repo.issueCountsBySeverity.low),
      }

      reporter.info('')
      reporter.info(
        sprintf(
          '%-70s %s',
          getProjectName(project),
          buildStatsLine(totalCount),
        ),
      )

      for (const { repo } of repos) {
        reporter.info(
          sprintf(
            '  %-68s %s',
            repo.name,
            buildStatsLine(repo.issueCountsBySeverity),
          ),
        )
      }
    })
  }
}

const command: CommandModule = {
  command: 'report',
  describe: 'Report Snyk projects status',
  handler: async () =>
    report({
      reporter: createReporter(),
      snyk: await createSnykService(createConfig()),
      github: await createGitHubService(createConfig()),
    }),
}

export default command
