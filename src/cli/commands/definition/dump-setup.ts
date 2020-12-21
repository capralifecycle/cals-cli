import fs from "fs"
import yaml from "js-yaml"
import { keyBy } from "lodash"
import pMap from "p-map"
import { CommandModule } from "yargs"
import { Config } from "../../../config"
import {
  DefinitionFile,
  getGitHubOrgs,
  getRepoId,
  getRepos,
} from "../../../definition/definition"
import {
  Definition,
  DefinitionRepo,
  GetReposResponse,
  Project,
  RepoTeam,
  Team,
  User,
} from "../../../definition/types"
import { createGitHubService, GitHubService } from "../../../github/service"
import {
  OrgsGetResponse,
  Permission,
  Repo,
  ReposGetResponse,
  ReposListTeamsResponseItem,
  TeamMemberOrInvited,
  TeamsListResponseItem,
} from "../../../github/types"
import { createSnykService, SnykService } from "../../../snyk/service"
import { SnykGitHubRepo } from "../../../snyk/types"
import { getGitHubRepo } from "../../../snyk/util"
import { Reporter } from "../../reporter"
import {
  createCacheProvider,
  createConfig,
  createReporter,
  definitionFileOptionName,
  definitionFileOptionValue,
  getDefinitionFile,
} from "../../util"
import { reportRateLimit } from "../github/util"
import { reorderListToSimilarAsBefore } from "./util"

interface DetailedProject {
  name: string
  repos: {
    [org: string]: {
      basic: Repo
      repository: ReposGetResponse
      teams: ReposListTeamsResponseItem[]
    }[]
  }
}

async function getReposFromGitHub(
  github: GitHubService,
  orgs: OrgsGetResponse[],
): Promise<DetailedProject["repos"][0]> {
  return (
    await pMap(orgs, async (org) => {
      const repos = await github.getOrgRepoList({ org: org.login })
      return pMap(repos, async (repo) => {
        const detailedRepo = await github.getRepository(
          repo.owner.login,
          repo.name,
        )
        if (detailedRepo === undefined) {
          throw Error(`Repo not found: ${repo.owner.login}/${repo.name}`)
        }

        return {
          basic: repo,
          repository: detailedRepo,
          teams: await github.getRepositoryTeamsList(detailedRepo),
        }
      })
    })
  ).flat()
}

async function getTeams(github: GitHubService, orgs: OrgsGetResponse[]) {
  const intermediate = await pMap(orgs, async (org) => {
    const teams = await github.getTeamList(org)
    return {
      org,
      teams: await pMap(teams, async (team) => ({
        team,
        users: await github.getTeamMemberListIncludingInvited(org, team),
      })),
    }
  })

  // Transform output.
  return intermediate.reduce<{
    [org: string]: {
      team: TeamsListResponseItem
      users: TeamMemberOrInvited[]
    }[]
  }>((prev, cur) => {
    prev[cur.org.login] = cur.teams
    return prev
  }, {})
}

function getCommonTeams(ownerRepos: DetailedProject["repos"][0]) {
  return ownerRepos.length === 0
    ? []
    : ownerRepos[0].teams.filter((team) =>
        ownerRepos.every((repo) =>
          repo.teams.some(
            (otherTeam) =>
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
  return teams.filter(
    (team) =>
      !commonTeams.some(
        (it) => it.name === team.name && it.permission === team.permission,
      ),
  )
}

function getFormattedTeams(
  oldTeams: RepoTeam[],
  teams: ReposListTeamsResponseItem[],
) {
  const result =
    teams.length === 0
      ? undefined
      : teams.map<RepoTeam>((it) => ({
          name: it.name,
          permission: it.permission as Permission,
        }))

  return result
    ? reorderListToSimilarAsBefore(oldTeams ?? [], result, (it) => it.name)
    : undefined
}

async function getOrgs(github: GitHubService, orgs: string[]) {
  return pMap(orgs, (it) => github.getOrg(it))
}

function removeDuplicates<T, R>(items: T[], selector: (item: T) => R): T[] {
  const ids: R[] = []
  const result: T[] = []
  for (const item of items) {
    const id = selector(item)
    if (!ids.includes(id)) {
      result.push(item)
      ids.push(id)
    }
  }
  return result
}

async function getMembers(github: GitHubService, orgs: OrgsGetResponse[]) {
  return removeDuplicates(
    (
      await pMap(orgs, (org) =>
        github.getOrgMembersListIncludingInvited(org.login),
      )
    )
      .flat()
      .map((it) => it.login),
    (it) => it,
  )
}

async function getSnykRepos(snyk: SnykService, definition: Definition) {
  return (await snyk.getProjects(definition))
    .map((it) => getGitHubRepo(it))
    .filter((it): it is SnykGitHubRepo => it !== undefined)
    .map((it) => getRepoId(it.owner, it.name))
}

async function getProjects(
  github: GitHubService,
  orgs: OrgsGetResponse[],
  definition: Definition,
  snyk: SnykService,
) {
  const snykReposPromise = getSnykRepos(snyk, definition)

  const repos = await getReposFromGitHub(github, orgs)
  const snykRepos = await snykReposPromise

  const definitionRepos = keyBy(getRepos(definition), (it) => it.id)

  const projectGroups = Object.values(
    repos.reduce<{
      [project: string]: {
        name: string
        definition?: Project
        repos: {
          [owner: string]: typeof repos
        }
      }
    }>((acc, cur) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const org = cur.repository.owner!.login
      const repoId = getRepoId(org, cur.repository.name)

      const projectName = definitionRepos[repoId]?.project?.name ?? "Unknown"
      const project = acc[projectName] || {
        name: projectName,
        definition: definitionRepos[repoId]?.project,
        repos: [],
      }

      return {
        ...acc,
        [projectName]: {
          ...project,
          repos: {
            ...project.repos,
            [org]: [...(project.repos[org] || []), cur],
          },
        },
      }
    }, {}),
  )

  const projects = projectGroups.map<Project>((project) => {
    const github = Object.entries(project.repos).map(([org, list]) => {
      const commonTeams = getCommonTeams(list)
      const oldOrg = project.definition?.github?.find(
        (it) => it.organization == org,
      )

      const repos = list.map<DefinitionRepo>((repo) => {
        const repoId = getRepoId(repo.basic.owner.login, repo.basic.name)
        const definitionRepo: GetReposResponse = definitionRepos[repoId]

        const result: DefinitionRepo = {
          name: repo.basic.name,
          previousNames: definitionRepo?.repo.previousNames,
          archived: repo.repository.archived ? true : undefined,
          issues: repo.repository.has_issues ? undefined : false,
          wiki: repo.repository.has_wiki ? undefined : false,
          teams: getFormattedTeams(
            definitionRepo?.repo?.teams ?? [],
            getSpecificTeams(repo.teams, commonTeams),
          ),
          snyk: snykRepos.includes(repoId) ? true : undefined,
          public: repo.repository.private ? undefined : true,
          responsible: definitionRepo?.repo.responsible,
        }

        // Try to preserve property order.
        return Object.fromEntries(
          reorderListToSimilarAsBefore(
            definitionRepo ? Object.entries(definitionRepo.repo) : [],
            Object.entries(result),
            (it) => it[0],
            true,
          ),
        ) as DefinitionRepo
      })

      const teams = getFormattedTeams(oldOrg?.teams ?? [], commonTeams)

      return {
        organization: org,
        teams: teams,
        repos: reorderListToSimilarAsBefore(
          oldOrg?.repos ?? [],
          repos,
          (it) => it.name,
        ),
      }
    })

    return {
      name: project.name,
      github: reorderListToSimilarAsBefore(
        project.definition?.github ?? [],
        github,
        (it) => it.organization,
      ),
    }
  })

  return reorderListToSimilarAsBefore(
    definition.projects,
    projects,
    (it) => it.name,
  )
}

function buildGitHubTeamsList(
  definition: Definition,
  list: Record<
    string,
    {
      team: TeamsListResponseItem
      users: TeamMemberOrInvited[]
    }[]
  >,
) {
  const result = Object.entries(list).map(([org, teams]) => ({
    organization: org,
    teams: teams.map<Team>((team) => ({
      name: team.team.name,
      members: team.users
        .map((it) => it.login)
        .sort((a, b) => a.localeCompare(b)),
    })),
  }))

  return reorderListToSimilarAsBefore(
    definition.github.teams,
    result,
    (it) => it.organization,
  )
}

function buildGitHubUsersList(
  definition: Definition,
  members: string[],
): User[] {
  const result = members.map<User>(
    (memberLogin) =>
      definition.github.users.find((user) => user.login === memberLogin) || {
        type: "external",
        login: memberLogin,
        // TODO: Fetch name from GitHub?
        name: "*Unknown*",
      },
  )

  return reorderListToSimilarAsBefore(
    definition.github.users,
    result,
    (it) => it.login,
  )
}

async function dumpSetup(
  config: Config,
  reporter: Reporter,
  github: GitHubService,
  snyk: SnykService,
  outfile: string,
  definitionFile: DefinitionFile,
) {
  reporter.info("Fetching data. This might take some time")
  const definition = await definitionFile.getDefinition()
  const orgs = await getOrgs(github, getGitHubOrgs(definition))

  const teams = getTeams(github, orgs)
  const members = getMembers(github, orgs)
  const projects = getProjects(github, orgs, definition, snyk)

  const generatedDefinition: Definition = {
    snyk: definition.snyk,
    github: {
      users: buildGitHubUsersList(definition, await members),
      teams: buildGitHubTeamsList(definition, await teams),
    },
    projects: await projects,
  }

  // TODO: An earlier version we had preserved comments by using yawn-yaml
  //  package. However it often produced invalid yaml, so we have removed
  //  it. We might want to revisit it to preserve comments.

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
  const doc = yaml.safeLoad(await definitionFile.getContents()) as any
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  doc.snyk = generatedDefinition.snyk
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  doc.projects = generatedDefinition.projects
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  doc.github = generatedDefinition.github

  // Convert to/from plain JSON so that undefined elements are removed.
  fs.writeFileSync(outfile, yaml.safeDump(JSON.parse(JSON.stringify(doc))))
  reporter.info(`Saved to ${outfile}`)
  reporter.info(`Number of GitHub requests: ${github.requestCount}`)
}

const command: CommandModule = {
  command: "dump-setup",
  describe:
    "Dump active setup as YAML. Will be formated same as the definition file.",
  builder: (yargs) =>
    yargs
      .positional("outfile", {
        type: "string",
      })
      .option(definitionFileOptionName, definitionFileOptionValue)
      .demandOption("outfile"),
  handler: async (argv) => {
    const reporter = createReporter(argv)
    const config = createConfig()
    const github = await createGitHubService({
      config,
      cache: createCacheProvider(config, argv),
    })
    const snyk = createSnykService({ config })
    await reportRateLimit(reporter, github, () =>
      dumpSetup(
        config,
        reporter,
        github,
        snyk,
        argv.outfile as string,
        getDefinitionFile(argv),
      ),
    )
  },
}

export default command
