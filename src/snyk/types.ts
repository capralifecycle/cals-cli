// See https://snyk.docs.apiary.io/#reference/projects/all-projects/list-all-projects
export interface SnykProject {
  name: string
  id: string
  created: string
  origin: string
  type: string
  testFrequency: string
  isMonitored: boolean
  totalDependencies: number
  issueCountsBySeverity: {
    low: number
    high: number
    medium: number
  }
  // TODO: Check if lastTestedDate is actually always given - just to be safe now.
  lastTestedDate?: string | null
  browseUrl: string
  // undocumented
  // imageTag: string
}

export interface SnykGitHubRepo {
  owner: string
  name: string
}
