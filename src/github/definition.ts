import fs from 'fs'
import yaml from 'js-yaml'
import { Omit } from '../types'
import { GitHubService } from './service'
import {
  Definition,
  DefinitionRepo,
  Permission,
  Project,
  RepoTeam,
  Team,
  UserBot,
  UserEmployee,
  UserExternal,
} from './types'

interface YamlDefinition {
  users: YamlDefinitionUsers
  teams: Team[]
  projects: YamlProject[]
}

type YamlProject = Omit<Project, 'repos' | 'teams'> & {
  repos: YamlDefinitionRepo[]
  teams: YamlRepoTeam[]
}

type YamlDefinitionRepo = Omit<DefinitionRepo, 'teams'> & {
  teams?: YamlRepoTeam[]
}

type YamlRepoTeam = Omit<RepoTeam, 'permission'> & {
  permission: YamlPermission
}

interface YamlDefinitionUsers {
  bots: UserBot[]
  employees: UserEmployee[]
  external: UserExternal[]
}

type YamlPermission = 'ADMIN' | 'PUSH' | 'PULL'

export function getDefinition(github: GitHubService) {
  const data = yaml.safeLoad(
    fs.readFileSync(github.getDefinitionFile(), 'utf-8'),
  ) as YamlDefinition

  // Convert from the stored format to our preferred format in code.
  const definition: Definition = {
    users: [
      ...data.users.bots.map<UserBot>(it => ({
        ...it,
        type: 'bot',
      })),
      ...data.users.employees.map<UserEmployee>(it => ({
        ...it,
        type: 'employee',
      })),
      ...data.users.external.map<UserExternal>(it => ({
        ...it,
        type: 'external',
      })),
    ],
    teams: data.teams,
    projects: data.projects.map(project => ({
      ...project,
      repos: project.repos.map(repo => ({
        ...repo,
        teams:
          repo.teams === undefined
            ? undefined
            : repo.teams.map(team => ({
                ...team,
                permission: permissionFromYaml(team.permission),
              })),
      })),
      teams: project.teams.map(team => ({
        ...team,
        permission: permissionFromYaml(team.permission),
      })),
    })),
  }

  validateDefinition(definition)
  return definition
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
  const teamNameList = definition.teams.reduce<string[]>((acc, team) => {
    if (acc.includes(team.name)) {
      throw new Error(`Duplicate team: ${team.name}`)
    }
    return [...acc, team.name]
  }, [])

  // Verify team members exists as users.
  definition.teams.forEach(team => {
    team.members.forEach(login => {
      if (!loginList.includes(login)) {
        throw new Error(
          `Team member $login in team ${
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
    project.teams.forEach(team => {
      if (!teamNameList.includes(team.name)) {
        throw new Error(
          `Project team ${team.name} in project ${
            project.name
          } is not registered in team list`,
        )
      }
    })
  })

  // Verify no duplicates in repos.
  definition.projects
    .flatMap(it => it.repos)
    .reduce<string[]>((acc, repo) => {
      if (acc.includes(repo.name)) {
        throw new Error(`Duplicate repo: ${repo.name}`)
      }
      return [...acc, repo.name]
    }, [])
}

function permissionFromYaml(permission: YamlPermission): Permission {
  switch (permission) {
    case 'ADMIN':
      return 'admin'
    case 'PULL':
      return 'pull'
    case 'PUSH':
      return 'push'
  }
  throw Error(`Unknown permission: ${permission}`)
}
