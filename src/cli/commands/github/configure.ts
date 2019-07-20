import { OrgsGetResponse, TeamsListResponseItem } from '@octokit/rest'
import yargs, { CommandModule } from 'yargs'
import { Reporter } from '../../../cli/reporter'
import { getDefinition, getGitHubOrgs } from '../../../definition/definition'
import { Definition } from '../../../definition/types'
import {
  createChangeSetItemsForMembers,
  createChangeSetItemsForProjects,
  createChangeSetItemsForTeams,
} from '../../../github/changeset/changeset'
import { ChangeSetItem } from '../../../github/changeset/types'
import { createGitHubService, GitHubService } from '../../../github/service'
import { createCacheProvider, createConfig, createReporter } from '../../util'
import { reportRateLimit } from './util'

function createOrgGetter(github: GitHubService) {
  const orgs: {
    [name: string]: {
      org: OrgsGetResponse
      teams: TeamsListResponseItem[]
    }
  } = {}

  return async function(orgName: string) {
    if (!(orgName in orgs)) {
      const org = await github.getOrg('capralifecycle')
      orgs[orgName] = {
        org,
        teams: await github.getTeamList(org),
      }
    }
    return orgs[orgName]
  }
}

function reportChanges(
  reporter: Reporter,
  title: string,
  changes: ChangeSetItem[],
) {
  if (changes.length === 0) {
    reporter.info(`No changes in ${title}`)
  } else {
    reporter.info(`Changes in ${title}:`)
    for (const change of changes) {
      reporter.info('  - ' + JSON.stringify(change))
    }
  }
}

async function processProjects(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
  getOrg: ReturnType<typeof createOrgGetter>,
  dryRun: boolean,
) {
  const changes = await createChangeSetItemsForProjects(
    github,
    definition,
    getOrg,
  )
  reportChanges(reporter, 'project', changes)

  /*
  if (!dryRun) {
    github.setTeamPermission(repo, found, repoteam.permission)
  }
  */
}

async function processMembers(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
  org: OrgsGetResponse,
) {
  const changes = await createChangeSetItemsForMembers(github, definition, org)
  reportChanges(reporter, 'members', changes)
}

async function processTeams(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
) {
  let changes: ChangeSetItem[] = []

  for (const orgName of getGitHubOrgs(definition)) {
    const org = await github.getOrg(orgName)
    changes = [
      ...changes,
      ...(await createChangeSetItemsForTeams(github, definition, org)),
    ]
  }

  reportChanges(reporter, 'teams', changes)
}

function checkOwner(owner: string) {
  if (owner !== 'capralifecycle') {
    throw Error('Only owner==capralifecycle allowed for this command')
  }
}

const projectsCommand: CommandModule = {
  command: 'projects',
  describe: 'Configure projects',
  builder: yargs =>
    yargs.options('dry-run', {
      describe: 'Run in dry run mode',
      type: 'boolean',
    }),
  handler: async argv => {
    checkOwner(argv['org'] as string)

    const reporter = createReporter()
    const config = createConfig()
    const github = await createGitHubService(
      config,
      createCacheProvider(config),
    )
    await reportRateLimit(reporter, github, async () => {
      const definition = getDefinition(config)
      await processProjects(
        reporter,
        github,
        definition,
        createOrgGetter(github),
        !!argv['dry-run'],
      )
    })
  },
}

const membersCommand: CommandModule = {
  command: 'members',
  describe: 'Configure members',
  handler: async argv => {
    checkOwner(argv['org'] as string)

    const reporter = createReporter()
    const config = createConfig()
    const github = await createGitHubService(
      config,
      createCacheProvider(config),
    )
    await reportRateLimit(reporter, github, async () => {
      const org = await github.getOrg('capralifecycle')
      const definition = getDefinition(config)
      await processMembers(reporter, github, definition, org)
    })
  },
}

const teamsCommand: CommandModule = {
  command: 'teams',
  describe: 'Configure teams',
  handler: async argv => {
    checkOwner(argv['org'] as string)

    const reporter = createReporter()
    const config = createConfig()
    const github = await createGitHubService(
      config,
      createCacheProvider(config),
    )
    await reportRateLimit(reporter, github, async () => {
      const definition = getDefinition(config)
      await processTeams(reporter, github, definition)
    })
  },
}

const command: CommandModule = {
  command: 'configure',
  describe: 'Configure CALS GitHub resources',
  builder: yargs =>
    yargs
      .command(projectsCommand)
      .command(membersCommand)
      .command(teamsCommand),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
