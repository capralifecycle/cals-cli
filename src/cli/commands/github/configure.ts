import {
  OrgsGetResponse,
  OrgsListMembersResponseItem,
  TeamsListResponseItem,
} from '@octokit/rest'
import { sortBy } from 'lodash'
import { sprintf } from 'sprintf-js'
import yargs, { CommandModule } from 'yargs'
import { Reporter } from '../../../cli/reporter'
import {
  getDefinition,
  getGitHubOrgs,
  getRepos,
} from '../../../github/definition'
import { createGitHubService, GitHubService } from '../../../github/service'
import { Definition, Repo, User } from '../../../github/types'
import { createConfig, createReporter } from '../../util'

interface MembersDiff {
  unknownMembers: OrgsListMembersResponseItem[]
  missingMembers: User[]
  memberCount: number
}

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

async function getMembersDiff(
  githubService: GitHubService,
  org: OrgsGetResponse,
  users: User[],
): Promise<MembersDiff> {
  const unknownMembers: OrgsListMembersResponseItem[] = []

  const usersLogins = users.map(it => it.login)
  const foundLogins: string[] = []
  let memberCount = 0

  const members = await githubService.getOrgMembersList(org.login)
  members.forEach(user => {
    memberCount++
    if (usersLogins.includes(user.login)) {
      foundLogins.push(user.login)
    } else {
      unknownMembers.push(user)
    }
  })

  const missingMembers = users.filter(it => !foundLogins.includes(it.login))

  return {
    unknownMembers,
    missingMembers,
    memberCount,
  }
}

async function processProjects(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
  getOrg: ReturnType<typeof createOrgGetter>,
  dryRun: boolean,
) {
  for (const project of definition.projects) {
    reporter.log('-----------------------------------')
    reporter.log(
      `Processing project: ${project.name}${dryRun ? ' (dry run)' : ''}`,
    )

    for (const [orgName, orgDesc] of Object.entries(project.github)) {
      const { teams } = await getOrg(orgName)

      for (const projectRepo of orgDesc.repos) {
        reporter.log(`Repo: ${projectRepo.name}`)
        const repo = await github.getRepository(orgName, projectRepo.name)
        if (repo === undefined) {
          reporter.log("  Failed to fetch repo - maybe it's moved?")
          continue
        }

        if (
          projectRepo.archived !== undefined &&
          projectRepo.archived !== repo.archived
        ) {
          reporter.log(
            `  Archive mismatch: wanted=${projectRepo.archived} actual=${
              repo.archived
            }`,
          )
        }

        if (
          projectRepo.issues !== undefined &&
          projectRepo.issues !== repo.has_issues &&
          !repo.archived
        ) {
          reporter.log(
            `  Issues mismatch: wanted=${projectRepo.issues} actual=${
              repo.has_issues
            }`,
          )
        }

        if (
          projectRepo.wiki !== undefined &&
          projectRepo.wiki !== repo.has_wiki &&
          !repo.archived
        ) {
          reporter.log(
            `  Wiki mismatch: wanted=${projectRepo.wiki} actual=${
              repo.has_wiki
            }`,
          )
        }

        const expectedTeams = [
          ...(orgDesc.teams || []),
          ...(projectRepo.teams || []),
        ]
        const existingTeams = await github.getRepositoryTeamsList(repo)

        // Check for teams to be added / modified.
        for (const repoteam of expectedTeams) {
          const found = existingTeams.find(it => repoteam.name === it.name)
          if (found !== undefined) {
            if (found.permission !== repoteam.permission) {
              reporter.log(
                sprintf(
                  '  Updating team %s from permission %s to %s',
                  found.name,
                  found.permission,
                  repoteam.permission,
                ),
              )
              if (!dryRun) {
                github.setTeamPermission(repo, found, repoteam.permission)
              }
            }
          } else {
            const team = teams.find(it => repoteam.name === it.name)
            if (team === undefined) {
              throw Error(`Unknown team: ${repoteam.name}`)
            }

            reporter.log(
              sprintf('  Adding team %s (%s)', team.name, repoteam.permission),
            )
            if (!dryRun) {
              github.setTeamPermission(repo, team, repoteam.permission)
            }
          }
        }

        // Check for teams that should not be registered.
        for (const team of existingTeams) {
          if (!expectedTeams.some(it => team.name === it.name)) {
            reporter.log(
              sprintf(
                '  Team not expected: %s (%s) - manual modification needed',
                team.name,
                team.permission,
              ),
            )
          }
        }
      }
    }
  }

  const knownRepos = getRepos(definition).map(it => it.id)

  const allRepos: Repo[] = []
  for (const orgName of getGitHubOrgs(definition)) {
    const repos = await github.getRepoList({ owner: orgName })
    allRepos.push(...repos)
  }

  const unknownRepos = sortBy(
    allRepos.filter(it => !knownRepos.includes(`${it.owner.login}/${it.name}`)),
    it => `${it.owner.login}/${it.name}`,
  )

  if (unknownRepos.length > 0) {
    reporter.log('-----------------------------------')
    reporter.log('Listing unknown repos:')
    for (const it of unknownRepos) {
      reporter.log(`Repo: ${it.owner.login}/${it.name}`)
    }
  }
}

async function processMembers(
  reporter: Reporter,
  github: GitHubService,
  org: OrgsGetResponse,
  users: User[],
) {
  reporter.log('Checking member list')
  const membersDiff = await getMembersDiff(github, org, users)

  reporter.log(`Found ${membersDiff.memberCount} members`)

  membersDiff.missingMembers.forEach(it => {
    reporter.log(`User not member any more: ${it.login}`)
  })

  membersDiff.unknownMembers.forEach(it => {
    reporter.log(`Unknown member: ${it.login}`)
  })

  if (
    membersDiff.missingMembers.length === 0 &&
    membersDiff.unknownMembers.length === 0
  ) {
    reporter.log('All OK!')
  }
}

async function processTeams(
  reporter: Reporter,
  github: GitHubService,
  definition: Definition,
) {
  for (const orgName of getGitHubOrgs(definition)) {
    const org = await github.getOrg(orgName)
    const teams = definition.teams[orgName] || []

    const actualTeams = await github.getTeamList(org)
    const actualTeamNames = actualTeams.map(it => it.name)
    const wantedTeamNames = teams.map(it => it.name)

    actualTeams
      .filter(it => !wantedTeamNames.includes(it.name))
      .forEach(it => {
        reporter.log(`Team not saved in file: ${it.name}`)
      })

    teams
      .filter(it => !actualTeamNames.includes(it.name))
      .forEach(it => {
        reporter.log(`Team missing in GitHub: ${it.name}`)
      })

    const overlappingTeams = actualTeams.filter(it =>
      wantedTeamNames.includes(it.name),
    )
    for (const actualTeam of overlappingTeams) {
      const wantedTeam = teams.find(it => it.name === actualTeam.name)!
      reporter.log(`Team: ${actualTeam.name}`)

      const actualMembers = await github.getTeamMemberList(actualTeam)

      actualMembers
        .filter(it => !wantedTeam.members.includes(it.login))
        .forEach(it => {
          reporter.log(`  Extra member: ${it.login}`)
        })

      const actualMembersNames = actualMembers.map(it => it.login)

      wantedTeam.members
        .filter(it => !actualMembersNames.includes(it))
        .forEach(it => {
          reporter.log(`  Add member: ${it}`)
        })
    }
  }
}

async function reportRateLimit(
  reporter: Reporter,
  github: GitHubService,
  block: () => Promise<void>,
) {
  reporter.log(
    `Rate limit: ${(await github.octokit.rateLimit.get()).data.rate.remaining}`,
  )

  await block()

  reporter.log(
    `Rate limit: ${(await github.octokit.rateLimit.get()).data.rate.remaining}`,
  )
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
    const reporter = createReporter()
    const github = await createGitHubService(createConfig())
    await reportRateLimit(reporter, github, async () => {
      const definition = getDefinition(github)
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
  handler: async () => {
    const reporter = createReporter()
    const github = await createGitHubService(createConfig())
    await reportRateLimit(reporter, github, async () => {
      const org = await github.getOrg('capralifecycle')
      const definition = getDefinition(github)
      await processMembers(reporter, github, org, definition.users)
    })
  },
}

const teamsCommand: CommandModule = {
  command: 'teams',
  describe: 'Configure teams',
  handler: async () => {
    const reporter = createReporter()
    const github = await createGitHubService(createConfig())
    await reportRateLimit(reporter, github, async () => {
      const definition = getDefinition(github)
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
