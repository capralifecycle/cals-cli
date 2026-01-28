import fs from "node:fs"
import AJV from "ajv"
import yaml from "js-yaml"
import { uniq } from "../collections/collections"
import schema from "../definition-schema.json"
import type { Definition, GetReposResponse } from "./types"

export { schema }

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
  // Verify no duplicates in project names.
  definition.projects.reduce<string[]>((acc, project) => {
    if (acc.includes(project.name)) {
      throw new Error(`Duplicate project: ${project.name}`)
    }
    return [...acc, project.name]
  }, [])

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
