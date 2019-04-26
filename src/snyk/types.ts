// See https://snyk.docs.apiary.io/#reference/projects/all-projects/list-all-projects
export interface SnykProject {
  name: string
  id: string
  created: string
  origin: string
  type: string
  testFrequency: string
  totalDependencies: number
  issueCountsBySeverity: {
    low: number
    high: number
    medium: number
  }
  // undocumented
  // imageTag: string
}

export interface SnykGitHubRepo {
  owner: string
  name: string
  file: string
}
