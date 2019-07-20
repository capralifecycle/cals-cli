import { Permission } from '../github/types'

export interface Definition {
  snyk: {
    accountId: string
  }
  github: {
    users: User[]
    teams: {
      organization: string
      teams: Team[]
    }[]
  }
  projects: Project[]
}

export interface Project {
  name: string
  github: {
    organization: string
    repos?: DefinitionRepo[]
    teams?: RepoTeam[]
  }[]
}

export type User = UserBot | UserEmployee | UserExternal

export interface UserBot {
  type: 'bot'
  login: string
  name: string
}

export interface UserEmployee {
  type: 'employee'
  login: string
  capraUsername: string
  name: string
}

export interface UserExternal {
  type: 'external'
  login: string
  name: string
}

export interface DefinitionRepo {
  name: string
  archived?: boolean
  issues?: boolean
  wiki?: boolean
  teams?: RepoTeam[]
  snyk?: boolean
  public?: boolean
}

export interface RepoTeam {
  name: string
  permission: Permission
}

export interface Team {
  name: string
  members: string[] // Set
}
