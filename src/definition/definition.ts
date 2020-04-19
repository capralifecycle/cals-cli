import fs from "fs"
import yaml from "js-yaml"
import { uniq } from "lodash"
import { Definition } from "./types"

function getTeamId(org: string, teamName: string) {
  return `${org}/${teamName}`
}

export function getRepoId(orgName: string, repoName: string) {
  return `${orgName}/${repoName}`
}

function validateDefinition(definition: Definition) {
  // Verify no duplicates in users and extract known logins.
  const loginList = definition.github.users.reduce<string[]>((acc, user) => {
    if (acc.includes(user.login)) {
      throw new Error(`Duplicate login: ${user.login}`)
    }
    return [...acc, user.login]
  }, [])

  // Verify no duplicates in teams and extract team names.
  const teamIdList = definition.github.teams.reduce<string[]>(
    (acc, orgTeams) => {
      return orgTeams.teams.reduce<string[]>((acc1, team) => {
        const id = getTeamId(orgTeams.organization, team.name)
        if (acc1.includes(id)) {
          throw new Error(`Duplicate team: ${id}`)
        }
        return [...acc1, id]
      }, acc)
    },
    [],
  )

  // Verify team members exists as users.
  definition.github.teams
    .map((it) => it.teams)
    .flat()
    .forEach((team) => {
      team.members.forEach((login) => {
        if (!loginList.includes(login)) {
          throw new Error(
            `Team member ${login} in team ${team.name} is not registered in user list`,
          )
        }
      })
    })

  // Verify no duplicates in project names.
  definition.projects.reduce<string[]>((acc, project) => {
    if (acc.includes(project.name)) {
      throw new Error(`Duplicate project: ${project.name}`)
    }
    return [...acc, project.name]
  }, [])

  definition.projects.forEach((project) => {
    project.github.forEach((org) => {
      // Verify project teams exists as teams.
      ;(org.teams || []).forEach((team) => {
        const id = getTeamId(org.organization, team.name)
        if (!teamIdList.includes(id)) {
          throw new Error(
            `Project team ${id} in project ${project.name} is not registered in team list`,
          )
        }
      })

      // Verify repo teams exists as teams.
      ;(org.repos || []).forEach((repo) => {
        ;(repo.teams || []).forEach((team) => {
          const id = getTeamId(org.organization, team.name)
          if (!teamIdList.includes(id)) {
            throw new Error(
              `Repo team ${id} for repo ${repo.name} in project ${project.name} is not registered in team list`,
            )
          }
        })
      })
    })
  })

  // Verify no duplicates in repos.
  definition.projects
    .flatMap((project) =>
      project.github
        .map((org) =>
          (org.repos || []).map((repo) =>
            getRepoId(org.organization, repo.name),
          ),
        )
        .flat(),
    )
    .reduce<string[]>((acc, repoName) => {
      if (acc.includes(repoName)) {
        throw new Error(`Duplicate repo: ${repoName}`)
      }
      return [...acc, repoName]
    }, [])
}

export class DefinitionFile {
  private path: string

  constructor(path: string) {
    this.path = path
  }

  public async getContents(): Promise<string> {
    return new Promise((resolve, reject) =>
      fs.readFile(this.path, "utf-8", (err, data) => {
        if (err) reject(err)
        else resolve(data)
      }),
    )
  }

  public async getDefinition(): Promise<Definition> {
    const definition = yaml.safeLoad(await this.getContents()) as Definition
    validateDefinition(definition)
    return definition
  }
}

export function getRepos(definition: Definition) {
  return definition.projects.flatMap((project) =>
    project.github
      .map((org) =>
        (org.repos || []).map((repo) => ({
          id: getRepoId(org.organization, repo.name),
          orgName: org.organization,
          project,
          repo,
        })),
      )
      .flat(),
  )
}

export function getGitHubOrgs(definition: Definition) {
  return uniq(
    definition.projects.flatMap((project) =>
      project.github.map((it) => it.organization),
    ),
  )
}
