import fs from 'fs'
import yaml from 'js-yaml'
import { GitHubService } from './service'
import { Definition } from './types'

export function getDefinition(github: GitHubService) {
  const definition = yaml.safeLoad(getRawDefinition(github)) as Definition
  validateDefinition(definition)
  return definition
}

export function getRawDefinition(github: GitHubService) {
  return fs.readFileSync(github.getDefinitionFile(), 'utf-8')
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
    ;(project.teams || []).forEach(team => {
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
