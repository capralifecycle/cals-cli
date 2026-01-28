export interface Definition {
  projects: Project[]
}

export interface Project {
  name: string
  github: {
    organization: string
    repos?: DefinitionRepo[]
  }[]
  tags?: string[]
}

export interface DefinitionRepo {
  name: string
  previousNames?: DefinitionRepoPreviousName[]
  archived?: boolean
}

export interface DefinitionRepoPreviousName {
  name: string
  project: string
}

export interface GetReposResponse {
  id: string
  orgName: string
  project: Project
  repo: DefinitionRepo
}
