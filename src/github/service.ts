import Octokit, {
  OrgsGetResponse,
  OrgsListMembersResponseItem,
  OrgsListPendingInvitationsResponseItem,
  ReposGetResponse,
  ReposListTeamsResponseItem,
  Response,
  TeamsListMembersResponseItem,
  TeamsListPendingInvitationsResponseItem,
  TeamsListResponseItem,
} from '@octokit/rest'
import keytar from 'keytar'
import fetch from 'node-fetch'
import pLimit, { Limit } from 'p-limit'
import { CacheProvider } from '../cache'
import { Config } from '../config'
import {
  OrgMemberOrInvited,
  Permission,
  Repo,
  TeamMemberOrInvited,
} from './types'
import { undefinedForNotFound } from './util'

const keyringService = 'cals'
const keyringAccount = 'github-token'

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
    this.semaphore = pLimit(10)

    this.octokit.hook.wrap('request', async (request, options) => {
      if (options.method !== 'GET') {
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
      const key = Buffer.from(JSON.stringify(rest)).toString('base64')

      const cacheItem = this.cache.retrieveJson<EtagCacheItem<unknown>>(key)

      if (cacheItem !== undefined) {
        // Copying doesn't work, seems we need to mutate this.
        options.headers['If-None-Match'] = cacheItem.data.etag
      }

      const getResponse = async (
        allowRetry: boolean = true,
      ): Promise<Response<unknown> | undefined> => {
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
            await new Promise(resolve => setTimeout(resolve, 2000))
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
        'No token found. Register using `cals github set-token`\n',
      )
      return undefined
    }

    return result
  }

  public async runGraphqlQuery<T>(query: string) {
    const url = 'https://api.github.com/graphql'
    const headers = {
      Authorization: `Bearer ${await GitHubService.getToken()}`,
    }

    const response = await this.semaphore(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
        agent: this.config.agent,
      }),
    )

    if (response.status === 401) {
      process.stderr.write('Unauthorized - removing token\n')
      this.removeToken()
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
      // eslint-disable-next-line
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

  public async runRestGet<T>(subpath: string) {
    const response = await this.semaphore(async () =>
      fetch(`https://api.github.com${subpath}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${await GitHubService.getToken()}`,
        },
        agent: this.config.agent,
      }),
    )

    if (response.status === 401) {
      process.stderr.write('Unauthorized - removing token\n')
      this.removeToken()
    }

    if (!response.ok) {
      throw new Error(
        `Response from GitHub not OK (${response.status}): ${JSON.stringify(
          response,
        )}`,
      )
    }

    return (await response.json()) as T
  }

  public async getRepoList({ owner }: { owner: string }) {
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
  organization(login: "${owner}") {
    repositories(first: 100${after === null ? '' : `, after: "${after}"`}) {
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

    return this.cache.json(`repos-${owner}`, async () => {
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
        this.octokit.paginate(options),
      )) || []
    )
  }

  public async getOrgMembersInvitedList(org: string) {
    const options = this.octokit.orgs.listPendingInvitations.endpoint.merge({
      org,
    })
    return (
      (await undefinedForNotFound<OrgsListPendingInvitationsResponseItem[]>(
        this.octokit.paginate(options),
      )) || []
    )
  }

  public async getOrgMembersListIncludingInvited(
    org: string,
  ): Promise<OrgMemberOrInvited[]> {
    return [
      ...(await this.getOrgMembersList(org)).map<OrgMemberOrInvited>(it => ({
        type: 'member',
        login: it.login,
        data: it,
      })),
      ...(await this.getOrgMembersInvitedList(org)).map<OrgMemberOrInvited>(
        it => ({
          type: 'invited',
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
          this.octokit.paginate(options),
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
      return (await this.octokit.paginate(options)) as TeamsListResponseItem[]
    })
  }

  public async getTeamMemberList(team: TeamsListResponseItem) {
    return this.cache.json(`team-member-list-${team.id}`, async () => {
      const options = this.octokit.teams.listMembers.endpoint.merge({
        // eslint-disable-next-line
        team_id: team.id,
      })
      return (await this.octokit.paginate(
        options,
      )) as TeamsListMembersResponseItem[]
    })
  }

  public async getTeamMemberInvitedList(team: TeamsListResponseItem) {
    return this.cache.json(`team-member-invited-list-${team.id}`, async () => {
      const options = this.octokit.teams.listPendingInvitations.endpoint.merge({
        // eslint-disable-next-line
        team_id: team.id,
      })
      return (await this.octokit.paginate(
        options,
      )) as TeamsListPendingInvitationsResponseItem[]
    })
  }

  public async getTeamMemberListIncludingInvited(
    team: TeamsListResponseItem,
  ): Promise<TeamMemberOrInvited[]> {
    return [
      ...(await this.getTeamMemberList(team)).map<TeamMemberOrInvited>(it => ({
        type: 'member',
        login: it.login,
        data: it,
      })),
      ...(await this.getTeamMemberInvitedList(team)).map<TeamMemberOrInvited>(
        it => ({
          type: 'invited',
          login: it.login,
          data: it,
        }),
      ),
    ]
  }

  public async setTeamPermission(
    repo: ReposGetResponse,
    team: TeamsListResponseItem,
    permission: Permission,
  ) {
    await this.octokit.teams.addOrUpdateRepo({
      owner: repo.owner.login,
      repo: repo.name,
      // eslint-disable-next-line
      team_id: team.id,
      permission,
    })
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
        ? ''
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

    const pulls: QueryResult['search']['edges'][0]['node'][] = []
    let after = null

    while (true) {
      const query = getQuery(after)
      const res = await this.runGraphqlQuery<QueryResult>(query)

      pulls.push(...res.search.edges.map(it => it.node))

      if (!res.search.pageInfo.hasNextPage) {
        break
      }

      after = res.search.pageInfo.endCursor
    }

    return pulls.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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
