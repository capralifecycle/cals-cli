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
    // Not always present (e.g. for old tests still being latest).
    critical?: number
    high: number
    medium: number
    low: number
  }
  /**
   * E.g. http://github.com/capralifecycle/some-repo.git
   * Set when using the CLI.
   */
  remoteRepoUrl?: string
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
