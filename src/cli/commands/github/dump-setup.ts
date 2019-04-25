/// <reference types="../../../yawn-yaml" />
import {
  OrgsGetResponse,
  ReposGetResponse,
  ReposListTeamsResponseItem,
} from '@octokit/rest'
import fs from 'fs'
import { CommandModule } from 'yargs'
import YAWN from 'yawn-yaml/cjs'
import { provideCacheJson } from '../../../cache'
import { Config } from '../../../config'
import { getDefinition, getRawDefinition } from '../../../github/definition'
import { createGitHubService, GitHubService } from '../../../github/service'
import {
  Definition,
  DefinitionRepo,
  Permission,
  Repo,
  RepoTeam,
  Team,
  User,
} from '../../../github/types'
import { Reporter } from '../../reporter'
import { createConfig, createReporter } from '../../util'

interface DetailedProject {
  name: string
  repos: Array<{
    basic: Repo
    repository: ReposGetResponse
    teams: ReposListTeamsResponseItem[]
  }>
}

async function getRepos(
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
  outfile: string,
) {
  reporter.info('Fetching data. This might take some time')
  const org = await github.getOrg('capralifecycle')
  const definition = getDefinition(github)

  const projectMap = definition.projects
    .flatMap(project =>
      project.repos.map(repo => ({
        projectName: project.name,
        repoName: repo.name,
      })),
    )
    .reduce<{ [key: string]: string }>(
      (acc, cur) => ({
        ...acc,
        [cur.repoName]: cur.projectName,
      }),
      {},
    )

  const repos = await provideCacheJson(
    config,
    'dump-setup-repos',
    async () => await getRepos(github),
  )

  const projects = Object.values(
    repos.reduce<{
      [project: string]: {
        name: string
        repos: typeof repos
      }
    }>((acc, cur) => {
      const projectName = projectMap[cur.basic.name] || 'Unknown'
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
    .map<Definition['projects'][0]>(project => {
      const commonTeams = getCommonTeams(project)
      return {
        name: project.name,
        teams: getFormattedTeams(commonTeams),
        repos: project.repos
          .map<DefinitionRepo>(repo => ({
            name: repo.basic.name,
            archived: repo.repository.archived ? true : undefined,
            issues: repo.repository.has_issues ? undefined : false,
            wiki: repo.repository.has_wiki ? undefined : false,
            teams: getFormattedTeams(getSpecificTeams(repo.teams, commonTeams)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const teams = await getTeams(github, org)
  const members = await github.getOrgMembersList(org.login)

  const generatedDefinition: Definition = {
    projects,
    teams: teams
      // TODO: Only exclude if not referenced?
      .filter(it => it.members.length > 0)
      .map<Team>(team => ({
        name: team.team.name,
        members: team.members
          .map(it => it.login)
          .sort((a, b) => a.localeCompare(b)),
      })),
    users: members
      .map<User>(
        it =>
          definition.users.find(user => user.login === it.login) || {
            type: 'external',
            login: it.login,
            // TODO: Fetch name from GitHub?
            name: '*Unknown*',
          },
      )
      .sort((a, b) => a.login.localeCompare(b.login)),
  }

  // Convert to/from plain JSON so that undefined elements are removed.
  const yawn = new YAWN(getRawDefinition(github))
  yawn.json = JSON.parse(JSON.stringify(generatedDefinition))

  fs.writeFileSync(outfile, yawn.yaml)
  reporter.info(`Saved to ${outfile}`)
}

const command: CommandModule = {
  command: 'dump-setup',
  describe:
    'Dump active setup as YAML. Will be formated same as the GitHub definition file.',
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
    await dumpSetup(config, reporter, github, argv.outfile as string)
  },
}

export default command
