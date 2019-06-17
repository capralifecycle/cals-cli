/// <reference types="../../yawn-yaml" />
import {
  OrgsGetResponse,
  ReposGetResponse,
  ReposListTeamsResponseItem,
} from '@octokit/rest'
import fs from 'fs'
import yargs, { CommandModule } from 'yargs'
import YAWN from 'yawn-yaml/cjs'
import { provideCacheJson } from '../../cache'
import { Config } from '../../config'
import {
  getDefinition,
  getRawDefinition,
  getRepoId,
  getRepos,
} from '../../definition/definition'
import {
  Definition,
  DefinitionRepo,
  Project,
  RepoTeam,
  Team,
  User,
} from '../../definition/types'
import { createGitHubService, GitHubService } from '../../github/service'
import { Permission, Repo } from '../../github/types'
import { Reporter } from '../reporter'
import { createConfig, createReporter } from '../util'
import { createSnykService, SnykService } from '../../snyk/service'
import { getGitHubRepo } from '../../snyk/util'
import { SnykGitHubRepo } from '../../snyk/types'

interface DetailedProject {
  name: string
  repos: {
    basic: Repo
    repository: ReposGetResponse
    teams: ReposListTeamsResponseItem[]
  }[]
}

async function getReposFromGitHub(
  github: GitHubService,
): Promise<DetailedProject['repos']> {
  const repos = await github.getRepoList({ owner: 'capralifecycle' })
  const result = []
  for (const repo of repos) {
    const detailedRepo = await github.getRepository(repo.owner.login, repo.name)
    if (detailedRepo === undefined) {
      throw Error(`Repo not found: ${repo.owner.login}/${repo.name}`)
    }

    result.push({
      basic: repo,
      repository: detailedRepo,
      teams: await github.getRepositoryTeamsList(detailedRepo),
    })
  }

  return result
}

async function getTeams(github: GitHubService, org: OrgsGetResponse) {
  const result = []
  const teams = await github.getTeamList(org)
  for (const team of teams) {
    const members = await github.getTeamMemberList(team)
    result.push({
      team,
      members,
    })
  }

  return result
}

function getCommonTeams(project: DetailedProject) {
  return project.repos.length === 0
    ? []
    : project.repos[0].teams.filter(team =>
        project.repos.every(repo =>
          repo.teams.some(
            otherTeam =>
              otherTeam.name === team.name &&
              otherTeam.permission === team.permission,
          ),
        ),
      )
}

function getSpecificTeams(
  teams: ReposListTeamsResponseItem[],
  commonTeams: ReposListTeamsResponseItem[],
) {
  return teams.filter(team => !commonTeams.some(it => it.name === team.name))
}

function getFormattedTeams(teams: ReposListTeamsResponseItem[]) {
  return teams.length === 0
    ? undefined
    : teams
        .map<RepoTeam>(it => ({
          name: it.name,
          permission: it.permission as Permission,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

async function dumpSetup(
  config: Config,
  reporter: Reporter,
  github: GitHubService,
  snyk: SnykService,
  outfile: string,
) {
  reporter.info('Fetching data. This might take some time')
  const org = await github.getOrg('capralifecycle')
  const definition = getDefinition(config)

  const snykRepos = (await snyk.getProjects())
    .map(it => getGitHubRepo(it))
    .filter((it): it is SnykGitHubRepo => it !== undefined)
    .map(it => getRepoId(it.owner, it.name))

  const projectMap = getRepos(definition).reduce<Record<string, string>>(
    (acc, cur) => ({
      ...acc,
      [cur.id]: cur.project.name,
    }),
    {},
  )

  const repos = await provideCacheJson(
    config,
    'dump-setup-repos',
    async () => await getReposFromGitHub(github),
  )

  const projects = Object.values(
    repos.reduce<{
      [project: string]: {
        name: string
        repos: typeof repos
      }
    }>((acc, cur) => {
      const projectName =
        projectMap[
          getRepoId(cur.repository.owner.login, cur.repository.name)
        ] || 'Unknown'
      const project = acc[projectName] || {
        name: projectName,
        repos: [],
      }

      return {
        ...acc,
        [projectName]: {
          ...project,
          repos: [...project.repos, cur],
        },
      }
    }, {}),
  )
    .map<Project>(project => {
      const commonTeams = getCommonTeams(project)
      return {
        name: project.name,
        github: {
          // TODO: Other orgs
          capralifecycle: {
            teams: getFormattedTeams(commonTeams),
            repos: project.repos
              .map<DefinitionRepo>(repo => ({
                name: repo.basic.name,
                archived: repo.repository.archived ? true : undefined,
                issues: repo.repository.has_issues ? undefined : false,
                wiki: repo.repository.has_wiki ? undefined : false,
                teams: getFormattedTeams(
                  getSpecificTeams(repo.teams, commonTeams),
                ),
                snyk: snykRepos.includes(
                  getRepoId(repo.basic.owner.login, repo.basic.name),
                )
                  ? true
                  : undefined,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          },
        },
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const teams = await getTeams(github, org)
  const members = await github.getOrgMembersList(org.login)

  const generatedDefinition: Definition = {
    snyk: definition.snyk,
    projects,
    github: {
      teams: {
        // TODO: Other orgs
        capralifecycle: teams
          // TODO: Only exclude if not referenced?
          .filter(it => it.members.length > 0)
          .map<Team>(team => ({
            name: team.team.name,
            members: team.members
              .map(it => it.login)
              .sort((a, b) => a.localeCompare(b)),
          })),
      },
      users: members
        .map<User>(
          it =>
            definition.github.users.find(user => user.login === it.login) || {
              type: 'external',
              login: it.login,
              // TODO: Fetch name from GitHub?
              name: '*Unknown*',
            },
        )
        .sort((a, b) => a.login.localeCompare(b.login)),
    },
  }

  // Convert to/from plain JSON so that undefined elements are removed.
  const yawn = new YAWN(getRawDefinition(config))
  yawn.json = JSON.parse(JSON.stringify(generatedDefinition))

  fs.writeFileSync(outfile, yawn.yaml)
  reporter.info(`Saved to ${outfile}`)
}

const dumpSetupCommand: CommandModule = {
  command: 'dump-setup',
  describe:
    'Dump active setup as YAML. Will be formated same as the definition file.',
  builder: yargs =>
    yargs
      .positional('outfile', {
        type: 'string',
      })
      .demandOption('outfile'),
  handler: async argv => {
    const reporter = createReporter()
    const config = createConfig()
    const github = await createGitHubService(config)
    const snyk = await createSnykService(config)
    await dumpSetup(config, reporter, github, snyk, argv.outfile as string)
  },
}

const command: CommandModule = {
  command: 'definition',
  describe: 'CALS definition file management',
  builder: yargs =>
    yargs.command(dumpSetupCommand).demandCommand().usage(`cals definition

The definition file is located at
https://github.com/capralifecycle/resources-definition/blob/master/resources.yaml

The file ~/.cals-config.json must include a reference to the location of this
file. For example by having this content:

  {
    "definitionFile": "/home/henrste/projects/capralifecycle/resources-definition/resources.yaml"
  }

Also remember to fetch the resources-definition repository every time you use cals-cli.`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
