export interface Repo {
  name: string
  owner: {
    login: string
  }
  defaultBranchRef: {
    name: string
  }
  createdAt: string
  updatedAt: string
  sshUrl: string
  repositoryTopics: { edges: { node: { topic: { name: string } } }[] }
}

export type Permission = 'admin' | 'push' | 'pull'

export interface Definition {
  users: User[]
  teams: Team[]
  projects: Project[]
}

export interface Project {
  name: string
  repos: DefinitionRepo[]
  teams?: RepoTeam[]
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
}

export interface RepoTeam {
  name: string
  permission: Permission
}

export interface Team {
  name: string
  members: string[] // Set
}
