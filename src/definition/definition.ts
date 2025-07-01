import fs from "node:fs"
import AJV from "ajv"
import yaml from "js-yaml"
import { uniq } from "../collections/collections"
import schema from "../definition-schema.json"
import type { Definition, GetReposResponse } from "./types"

export { schema }

function getTeamId(org: string, teamName: string) {
  return `${org}/${teamName}`
}

export function getRepoId(orgName: string, repoName: string): string {
  return `${orgName}/${repoName}`
}

function checkAgainstSchema(
  value: unknown,
): { error: string } | { definition: Definition } {
  const ajv = new AJV({ allErrors: true })
  const valid = ajv.validate(schema, value)

  return valid
    ? { definition: value as Definition }
    : { error: ajv.errorsText() ?? "Unknown error" }
}

function requireValidDefinition(definition: Definition) {
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
    .flatMap((it) => it.teams)
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
      }) // Verify repo teams exists as teams.
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
      project.github.flatMap((org) =>
        (org.repos || []).map((repo) => getRepoId(org.organization, repo.name)),
      ),
    )
    .reduce<string[]>((acc, repoName) => {
      if (acc.includes(repoName)) {
        throw new Error(`Duplicate repo: ${repoName}`)
      }
      return [...acc, repoName]
    }, [])
}

export class DefinitionFile {
  private readonly path: string

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
    return parseDefinition(await this.getContents())
  }
}

export function parseDefinition(value: string): Definition {
  const result = checkAgainstSchema(yaml.load(value))

  if ("error" in result) {
    throw new Error(`Definition content invalid: ${result.error}`)
  }

  requireValidDefinition(result.definition)
  return result.definition
}

export function getRepos(definition: Definition): GetReposResponse[] {
  return definition.projects.flatMap((project) =>
    project.github.flatMap((org) =>
      (org.repos || []).map((repo) => ({
        id: getRepoId(org.organization, repo.name),
        orgName: org.organization,
        project,
        repo,
      })),
    ),
  )
}

export function getGitHubOrgs(definition: Definition): string[] {
  const githubOrganizations = definition.projects.flatMap((project) =>
    project.github.map((it) => it.organization),
  )
  return uniq(githubOrganizations)
}
