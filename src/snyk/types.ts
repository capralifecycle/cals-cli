// See https://apidocs.snyk.io/?version=2025-11-05#get-/orgs/-org_id-/projects
export interface ProjectResponse {
  data: RestAPIProject[]
  links: {
    next?: string
  }
}

export interface RestAPIProject {
  id: string
  attributes: {
    name: string
    type: string
    origin: string
    created: string
    status: string
    settings: {
      recurring_tests: {
        frequency: string
      }
    }
  }
  meta: {
    latest_dependency_total: {
      updated_at: string
      total: number
    }
    latest_issue_counts: {
      critical?: number
      high: number
      medium: number
      low: number
    }
  }
}

/** Type represents format of responses from the deprecated List all projects v1 API
 https://snyk.docs.apiary.io/#reference/projects/all-projects/list-all-projects **/
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
  // Will be null because it is not yet implemented in the new API
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
