import fs from 'fs'
import yaml from 'js-yaml'
import { uniq } from 'lodash'
import { Config } from '../config'
import { Definition } from './types'
import { getDefinitionFile } from './util'

export function getRawDefinition(config: Config) {
  return fs.readFileSync(getDefinitionFile(config), 'utf-8')
}

function getTeamId(org: string, teamName: string) {
  return `${org}/${teamName}`
}

export function getRepoId(orgName: string, repoName: string) {
  return `${orgName}/${repoName}`
}

function validateDefinition(definition: Definition) {
  // Verify no duplicates in users and extract known logins.
  const loginList = definition.users.reduce<string[]>((acc, user) => {
    if (acc.includes(user.login)) {
      throw new Error(`Duplicate login: ${user.login}`)
    }
    return [...acc, user.login]
  }, [])

  // Verify no duplicates in teams and extract team names.
  const teamIdList = Object.entries(definition.teams).reduce<string[]>(
    (acc, [githubOrg, teams]) => {
      return teams.reduce<string[]>((acc1, team) => {
        const id = getTeamId(githubOrg, team.name)
        if (acc1.includes(id)) {
          throw new Error(`Duplicate team: ${id}`)
        }
        return [...acc1, id]
      }, acc)
    },
    [],
  )

  // Verify team members exists as users.
  Object.values(definition.teams)
    .flat()
    .forEach(team => {
      team.members.forEach(login => {
        if (!loginList.includes(login)) {
          throw new Error(
            `Team member ${login} in team ${
              team.name
            } is not registered in user list`,
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

  // Verify project teams exists as teams.
  definition.projects.forEach(project => {
    Object.entries(project.github).forEach(([orgName, orgDesc]) => {
      ;(orgDesc.teams || []).forEach(team => {
        const id = getTeamId(orgName, team.name)
        if (!teamIdList.includes(id)) {
          throw new Error(
            `Project team ${id} in project ${
              project.name
            } is not registered in team list`,
          )
        }
      })
    })
  })

  // Verify no duplicates in repos.
  definition.projects
    .flatMap(project =>
      Object.entries(project.github)
        .map(([orgName, orgDesc]) =>
          orgDesc.repos.map(repo => getRepoId(orgName, repo.name)),
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

export function getDefinition(config: Config) {
  const definition = yaml.safeLoad(getRawDefinition(config)) as Definition
  validateDefinition(definition)
  return definition
}

export function getRepos(definition: Definition) {
  return definition.projects.flatMap(project =>
    Object.entries(project.github)
      .map(([orgName, orgDesc]) =>
        orgDesc.repos.map(repo => ({
          id: getRepoId(orgName, repo.name),
          orgName,
          project,
          repo,
        })),
      )
      .flat(),
  )
}

export function getGitHubOrgs(definition: Definition) {
  return uniq(
    definition.projects.flatMap(project => Object.keys(project.github)),
  )
}
