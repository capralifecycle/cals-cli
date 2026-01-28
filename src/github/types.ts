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
  isArchived: boolean
  sshUrl: string
  repositoryTopics: { edges: { node: { topic: { name: string } } }[] }
}
