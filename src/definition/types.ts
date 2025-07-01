import type { Permission } from "../github/types"

export interface Definition {
  snyk?: {
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
  tags?: string[]
  /**
   * Some external-defined entity being responsible for the project.
   */
  responsible?: string
}

export type User = UserBot | UserEmployee | UserExternal

export interface UserBot {
  type: "bot"
  login: string
  name: string
}

export interface UserEmployee {
  type: "employee"
  login: string
  capraUsername: string
  name: string
}

export interface UserExternal {
  type: "external"
  login: string
  name: string
}

export interface DefinitionRepo {
  name: string
  previousNames?: DefinitionRepoPreviousName[]
  archived?: boolean
  issues?: boolean
  wiki?: boolean
  teams?: RepoTeam[]
  snyk?: boolean
  public?: boolean
  /**
   * Some external-defined entity being responsible for the repository.
   *
   * Will override the project-defined responsible.
   */
  responsible?: string
}

export interface DefinitionRepoPreviousName {
  name: string
  project: string
}

export interface RepoTeam {
  name: string
  permission: Permission
}

export interface Team {
  name: string
  members: string[] // Set
}

export interface GetReposResponse {
  id: string
  orgName: string
  project: Project
  repo: DefinitionRepo
}
