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
