import { Octokit } from "@octokit/rest"
import { EndpointOptions, OctokitResponse } from "@octokit/types"
import keytar from "keytar"
import fetch from "node-fetch"
import pLimit, { Limit } from "p-limit"
import { CacheProvider } from "../cache"
import { Config } from "../config"
import {
  OrgMemberOrInvited,
  OrgsGetResponse,
  OrgsListMembersResponseItem,
  OrgsListPendingInvitationsResponseItem,
  Repo,
  ReposGetResponse,
  ReposListHooksResponseItem,
  ReposListTeamsResponseItem,
  TeamMemberOrInvited,
  TeamsListMembersResponseItem,
  TeamsListPendingInvitationsResponseItem,
  TeamsListResponseItem,
  VulerabilityAlert,
} from "./types"
import { undefinedForNotFound } from "./util"

const keyringService = "cals"
const keyringAccount = "github-token"

interface EtagCacheItem<T> {
  etag: string
  data: T
}

export class GitHubService {
  public constructor(config: Config, octokit: Octokit, cache: CacheProvider) {
    this.config = config
    this.octokit = octokit
    this.cache = cache

    // Control concurrency to GitHub API at service level so we
    // can maximize concurrency all other places.
    this.semaphore = pLimit(6)

    this.octokit.hook.wrap("request", async (request, options) => {
      this._requestCount++

      if (options.method !== "GET") {
        return this.semaphore(() => request(options))
      }

      // Try to cache ETag for GET requests to save on rate limiting.
      // Hits on ETag does not count towards rate limiting.

      const rest = {
        ...options,
      }
      delete rest.method
      delete rest.baseUrl
      delete rest.headers
      delete rest.mediaType
      delete rest.request

      // Build a key that is used to identify this request.
      const key = Buffer.from(JSON.stringify(rest)).toString("base64")

      const cacheItem = this.cache.retrieveJson<EtagCacheItem<unknown>>(key)

      if (cacheItem !== undefined) {
        // Copying doesn't work, seems we need to mutate this.
        options.headers["If-None-Match"] = cacheItem.data.etag
      }

      const getResponse = async (
        allowRetry = true,
      ): Promise<OctokitResponse<unknown> | undefined> => {
        try {
          return await request(options)
        } catch (e) {
          // Handle no change in ETag.
          if (e.status === 304) {
            return undefined
          }
          // GitHub seems to throw a lot of 502 errors.
          // Let's give it a few seconds and retry one time.
          if (e.status === 502 && allowRetry) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            return await getResponse(false)
          }
          throw e
        }
      }

      const response = await this.semaphore(async () => {
        return getResponse()
      })

      if (response === undefined) {
        // Use previous value.
        return cacheItem!!.data.data
      }

      // New value. Store Etag.
      if (response.headers.etag) {
        this.cache.storeJson<EtagCacheItem<unknown>>(key, {
          etag: response.headers.etag,
          data: response,
        })
      }

      return response
    })
  }

  private config: Config
  public octokit: Octokit
  private cache: CacheProvider
  private semaphore: Limit

  private _requestCount = 0

  public get requestCount(): number {
    return this._requestCount
  }

  private async removeToken() {
    await keytar.deletePassword(keyringService, keyringAccount)
  }

  public async setToken(value: string) {
    await keytar.setPassword(keyringService, keyringAccount, value)
  }

  public static async getToken(): Promise<string | undefined> {
    if (process.env.CALS_GITHUB_TOKEN) {
      return process.env.CALS_GITHUB_TOKEN
    }

    const result = await keytar.getPassword(keyringService, keyringAccount)
    if (result == null) {
      process.stderr.write(
        "No token found. Register using `cals github set-token`\n",
      )
      return undefined
    }

    return result
  }

  public async runGraphqlQuery<T>(query: string) {
    const url = "https://api.github.com/graphql"
    const headers = {
      Authorization: `Bearer ${await GitHubService.getToken()}`,
    }

    const response = await this.semaphore(() =>
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
        agent: this.config.agent,
      }),
    )

    if (response.status === 401) {
      process.stderr.write("Unauthorized - removing token\n")
      await this.removeToken()
    }

    if (!response.ok) {
      throw new Error(
        `Response from GitHub not OK (${response.status}): ${JSON.stringify(
          response,
        )}`,
      )
    }

    const json = (await response.json()) as {
      data?: T | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors?: any
    }

    if (!!json.errors) {
      throw new Error(
        `Error from GitHub GraphQL API: ${JSON.stringify(json.errors)}`,
      )
    }

    if (json.data == null) {
      throw new Error(
        `No data received from GitHub GraphQL API (unknown reason)`,
      )
    }

    return json.data
  }

  public async getOrgRepoList({ org }: { org: string }) {
    interface QueryResult {
      organization: {
        repositories: {
          totalCount: number
          pageInfo: {
            hasNextPage: boolean
            endCursor: string | null
          }
          nodes: Repo[] | null
        }
      } | null
    }

    const getQuery = (after: string | null) => `{
  organization(login: "${org}") {
    repositories(first: 100${after === null ? "" : `, after: "${after}"`}) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        owner {
          login
        }
        defaultBranchRef {
          name
        }
        createdAt
        updatedAt
        isArchived
        sshUrl
        repositoryTopics(first: 100) {
          edges {
            node {
              topic {
                name
              }
            }
          }
        }
      }
    }
  }
}`

    return this.cache.json(`repos-${org}`, async () => {
      const repos: Repo[] = []
      let after = null

      while (true) {
        const query = getQuery(after)
        const res = await this.runGraphqlQuery<QueryResult>(query)

        repos.push(...res.organization!.repositories.nodes!)

        if (!res.organization!.repositories.pageInfo.hasNextPage) {
          break
        }

        after = res.organization!.repositories.pageInfo.endCursor
      }

      return repos.sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  public async getOrgMembersList(org: string) {
    const options = this.octokit.orgs.listMembers.endpoint.merge({
      org,
    })
    return (
      (await undefinedForNotFound<OrgsListMembersResponseItem[]>(
        this.octokit.paginate(options as EndpointOptions),
      )) || []
    )
  }

  public async getOrgMembersInvitedList(org: string) {
    const options = this.octokit.orgs.listPendingInvitations.endpoint.merge({
      org,
    })
    return (
      (await undefinedForNotFound<OrgsListPendingInvitationsResponseItem[]>(
        this.octokit.paginate(options as EndpointOptions),
      )) || []
    )
  }

  public async getOrgMembersListIncludingInvited(
    org: string,
  ): Promise<OrgMemberOrInvited[]> {
    return [
      ...(await this.getOrgMembersList(org)).map<OrgMemberOrInvited>((it) => ({
        type: "member",
        login: it.login,
        data: it,
      })),
      ...(await this.getOrgMembersInvitedList(org)).map<OrgMemberOrInvited>(
        (it) => ({
          type: "invited",
          login: it.login,
          data: it,
        }),
      ),
    ]
  }

  public async getRepository(owner: string, repo: string) {
    return this.cache.json(`get-repository-${owner}-${repo}`, async () => {
      const response = await undefinedForNotFound(
        this.octokit.repos.get({
          owner,
          repo,
        }),
      )

      return response === undefined ? undefined : response.data
    })
  }

  public async getRepositoryTeamsList(repo: ReposGetResponse) {
    return this.cache.json(`repository-teams-list-${repo.id}`, async () => {
      const options = this.octokit.repos.listTeams.endpoint.merge({
        owner: repo.owner.login,
        repo: repo.name,
      })
      return (
        (await undefinedForNotFound<ReposListTeamsResponseItem[]>(
          this.octokit.paginate(options as EndpointOptions),
        )) || []
      )
    })
  }

  public async getRepositoryHooks(owner: string, repo: string) {
    return this.cache.json(`repository-hooks-${owner}-${repo}`, async () => {
      const options = this.octokit.repos.listHooks.endpoint.merge({
        owner,
        repo,
      })
      return (
        (await undefinedForNotFound<ReposListHooksResponseItem[]>(
          this.octokit.paginate(options as EndpointOptions),
        )) || []
      )
    })
  }

  public async getOrg(org: string) {
    const orgResponse = await this.octokit.orgs.get({
      org,
    })
    return orgResponse.data
  }

  public async getTeamList(org: OrgsGetResponse) {
    return this.cache.json(`team-list-${org.login}`, async () => {
      const options = this.octokit.teams.list.endpoint.merge({
        org: org.login,
      })
      return (await this.octokit.paginate(
        options as EndpointOptions,
      )) as TeamsListResponseItem[]
    })
  }

  public async getTeamMemberList(
    org: OrgsGetResponse,
    team: TeamsListResponseItem,
  ) {
    return this.cache.json(`team-member-list-${team.id}`, async () => {
      const options = this.octokit.teams.listMembersInOrg.endpoint.merge({
        org: org.login,
        team_slug: team.slug,
      })
      return (await this.octokit.paginate(
        options as EndpointOptions,
      )) as TeamsListMembersResponseItem[]
    })
  }

  public async getTeamMemberInvitedList(
    org: OrgsGetResponse,
    team: TeamsListResponseItem,
  ) {
    return this.cache.json(`team-member-invited-list-${team.id}`, async () => {
      const options = this.octokit.teams.listPendingInvitationsInOrg.endpoint.merge(
        {
          org: org.login,
          team_slug: team.slug,
        },
      )
      return (await this.octokit.paginate(
        options as EndpointOptions,
      )) as TeamsListPendingInvitationsResponseItem[]
    })
  }

  public async getTeamMemberListIncludingInvited(
    org: OrgsGetResponse,
    team: TeamsListResponseItem,
  ): Promise<TeamMemberOrInvited[]> {
    return [
      ...(await this.getTeamMemberList(org, team)).map<TeamMemberOrInvited>(
        (it) => ({
          type: "member",
          login: it.login,
          data: it,
        }),
      ),
      ...(await this.getTeamMemberInvitedList(org, team)).map<
        TeamMemberOrInvited
      >((it) => ({
        type: "invited",
        login: it.login,
        data: it,
      })),
    ]
  }

  public async getSearchedPullRequestList() {
    interface QueryResult {
      search: {
        pageInfo: {
          hasNextPage: boolean
          endCursor: string | null
        }
        edges: {
          node: {
            __typename: string
            number: number
            baseRepository: {
              name: string
              owner: {
                login: string
              }
              defaultBranchRef: {
                name: string
              }
            }
            author: {
              login: string
            }
            title: string
            commits: {
              nodes: {
                commit: {
                  messageHeadline: string
                }
              }[]
            }
            createdAt: string
            updatedAt: string
          }
        }[]
      }
    }

    const getQuery = (after: string | null) => `{
  search(
    query: "is:open is:pr user:capralifecycle user:capraconsulting archived:false",
    type: ISSUE,
    first: 100${
      after === null
        ? ""
        : `,
    after: "${after}"`
    }
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        __typename
        ... on PullRequest {
          number
          baseRepository {
            name
            owner {
              login
            }
            defaultBranchRef {
              name
            }
          }
          author {
            login
          }
          title
          commits(first: 10) {
            nodes {
              commit {
                messageHeadline
              }
            }
          }
          createdAt
          updatedAt
        }
      }
    }
  }
}`

    const pulls: QueryResult["search"]["edges"][0]["node"][] = []
    let after = null

    while (true) {
      const query = getQuery(after)
      const res = await this.runGraphqlQuery<QueryResult>(query)

      pulls.push(...res.search.edges.map((it) => it.node))

      if (!res.search.pageInfo.hasNextPage) {
        break
      }

      after = res.search.pageInfo.endCursor
    }

    return pulls.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  public async getHasVulnerabilityAlertsEnabled(
    owner: string,
    repo: string,
  ): Promise<boolean> {
    try {
      const response = await this.octokit.repos.checkVulnerabilityAlerts({
        owner: owner,
        repo: repo,
      })

      if (response.status !== 204) {
        console.log(response)
        throw new Error("Unknown response - see previous log line")
      }

      return true
    } catch (e) {
      if (e.status === 404) {
        return false
      }
      throw e
    }
  }

  public async enableVulnerabilityAlerts(
    owner: string,
    repo: string,
  ): Promise<void> {
    await this.octokit.repos.enableVulnerabilityAlerts({
      owner: owner,
      repo: repo,
    })
  }

  /**
   * Get the vulernability alerts for a repository.
   */
  public async getVulnerabilityAlerts(owner: string, repo: string) {
    interface QueryResult {
      repository: {
        vulnerabilityAlerts: {
          pageInfo: {
            hasNextPage: boolean
            endCursor: string | null
          }
          edges: Array<{
            node: VulerabilityAlert
          }> | null
        }
      } | null
    }

    const getQuery = (after: string | null) => `{
  repository(owner: "${owner}", name: "${repo}") {
    vulnerabilityAlerts(first: 100${
      after === null ? "" : `, after: "${after}"`
    }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          dismissReason
          vulnerableManifestFilename
          vulnerableManifestPath
          vulnerableRequirements
          securityAdvisory {
            description
            identifiers { type value }
            references { url }
            severity
          }
          securityVulnerability {
            package { name ecosystem }
            firstPatchedVersion { identifier }
            vulnerableVersionRange
          }
        }
      }
    }
  }
}`

    return this.cache.json(
      `vulnerability-alerts-${owner}-${repo}`,
      async () => {
        const result: VulerabilityAlert[] = []
        let after = null

        while (true) {
          const query = getQuery(after)
          const res = await this.runGraphqlQuery<QueryResult>(query)

          result.push(
            ...(res.repository?.vulnerabilityAlerts.edges?.map(
              (it) => it.node,
            ) ?? []),
          )

          if (!res.repository?.vulnerabilityAlerts.pageInfo.hasNextPage) {
            break
          }

          after = res.repository!.vulnerabilityAlerts.pageInfo.endCursor
        }

        return result
      },
    )
  }
}

async function createOctokit(config: Config) {
  return new Octokit({
    auth: await GitHubService.getToken(),
    request: {
      agent: config.agent,
    },
  })
}

export async function createGitHubService(
  config: Config,
  cache: CacheProvider,
) {
  return new GitHubService(config, await createOctokit(config), cache)
}
