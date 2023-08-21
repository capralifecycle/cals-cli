import fetch from "node-fetch"
import { Config } from "../config"
import { Definition } from "../definition/types"
import { SnykTokenCliProvider, SnykTokenProvider } from "./token"
import { RestAPIProject, ProjectResponse, SnykProject } from "./types"

interface SnykServiceProps {
  config: Config
  tokenProvider: SnykTokenProvider
}

export class SnykService {
  private config: Config
  private tokenProvider: SnykTokenProvider

  public constructor(props: SnykServiceProps) {
    this.config = props.config
    this.tokenProvider = props.tokenProvider
  }

  public async getProjects(definition: Definition): Promise<SnykProject[]> {
    const snykAccountId = definition.snyk?.accountId
    if (snykAccountId === undefined) {
      return []
    }

    return this.getProjectsByAccountId(snykAccountId)
  }

  public async getProjectsByAccountId(
    snykAccountId: string,
  ): Promise<SnykProject[]> {
    const token = await this.tokenProvider.getToken()
    if (token === undefined) {
      throw new Error("Missing token for Snyk")
    }

    let backportedProjects: SnykProject[] = []
    const snykRestApiVersion = "2023-08-04"

    let nextUrl: string | undefined = `/orgs/${encodeURIComponent(
      snykAccountId,
    )}/projects?version=${snykRestApiVersion}&meta.latest_dependency_total=true&meta.latest_issue_counts=true&limit=100`

    /* The Snyk REST API only allows us to retrieve 100 projects at a time.
     * The "links.next" value in the response gives us a pointer to the next 100 results.
     * We continue calling the Snyk API and retrieving more projects until links.next is null
     * */
    while (nextUrl) {
      const response = await fetch(`https://api.snyk.io/rest${nextUrl}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `token ${token}`,
        },
        agent: this.config.agent,
      })

      if (response.status === 401) {
        process.stderr.write("Unauthorized - removing token\n")
        await this.tokenProvider.markInvalid()
      }

      if (!response.ok) {
        throw new Error(
          `Response from Snyk not OK (${response.status}): ${JSON.stringify(
            response,
          )}`,
        )
      }

      // Check if the Sunset header is present in the response
      const sunsetHeader =
        response.headers.get("Sunset") || response.headers.get("sunset")
      if (sunsetHeader) {
        console.warn(
          `Snyk endpoint with version ${snykRestApiVersion} has been marked as deprecated with deprecation date ${sunsetHeader}`,
        )
      }

      const jsonResponse = (await response.json()) as ProjectResponse

      /* We transform the data to a standard format that we used for data from Snyk API v1 in order for
       the data to be backover compatible with existing consuments */
      backportedProjects = [
        ...backportedProjects,
        ...jsonResponse.data.map((project: RestAPIProject) => {
          return {
            id: project.id,
            name: project.attributes.name,
            type: project.attributes.type,
            created: project.attributes.created,
            origin: project.attributes.origin,
            testFrequency:
              project.attributes.settings.recurring_tests.frequency,
            isMonitored: project.attributes.status === "active",
            totalDependencies: project.meta.latest_dependency_total.total,
            issueCountsBySeverity: project.meta.latest_issue_counts,
            lastTestedDate: project.meta.latest_dependency_total.updated_at,
            browseUrl: `https://app.snyk.io/org/it/project/${project.id}`,
          }
        }),
      ]

      /* Update nextUrl with pointer to the next page of results based
       * on the "links.next" field in the JSON response */
      nextUrl = jsonResponse.links.next
    }

    return backportedProjects
  }
}

interface CreateSnykServiceProps {
  config: Config
  tokenProvider?: SnykTokenProvider
}

export function createSnykService(props: CreateSnykServiceProps): SnykService {
  return new SnykService({
    config: props.config,
    tokenProvider: props.tokenProvider ?? new SnykTokenCliProvider(),
  })
}
