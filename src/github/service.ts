import { Buffer } from "node:buffer"
import { performance } from "node:perf_hooks"
import * as process from "node:process"
import { Octokit } from "@octokit/rest"
import type { OctokitResponse } from "@octokit/types"
import fetch from "node-fetch"
import pLimit, { type LimitFunction } from "p-limit"
import type { CacheProvider } from "../cache"
import type { Config } from "../config"
import { GitHubTokenCliProvider, type GitHubTokenProvider } from "./token"
import type { Repo } from "./types"

interface EtagCacheItem<T> {
  etag: string
  data: T
}

interface GitHubServiceProps {
  config: Config
  octokit: Octokit
  cache: CacheProvider
  tokenProvider: GitHubTokenProvider
}

export class GitHubService {
  private config: Config
  public octokit: Octokit
  private cache: CacheProvider
  private tokenProvider: GitHubTokenProvider
  private semaphore: LimitFunction

  public constructor(props: GitHubServiceProps) {
    this.config = props.config
    this.octokit = props.octokit
    this.cache = props.cache
    this.tokenProvider = props.tokenProvider

    // Control concurrency to GitHub API at service level so we
    // can maximize concurrency all other places.
    this.semaphore = pLimit(6)

    this.octokit.hook.wrap("request", async (request, options) => {
      if (options.method !== "GET") {
        return this.semaphore(() => request(options))
      }

      // Try to cache ETag for GET requests to save on rate limiting.
      // Hits on ETag does not count towards rate limiting.

      const rest = {
        ...options,
      } as any
      delete rest.method
      delete rest.baseUrl
      delete rest.headers
      delete rest.mediaType
      delete rest.request

      // Build a key that is used to identify this request.
      const key = Buffer.from(JSON.stringify(rest)).toString("base64")

      const cacheItem =
        this.cache.retrieveJson<EtagCacheItem<ReturnType<typeof request>>>(key)

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
        // Undefined is returned for cached data.

        if (cacheItem === undefined) {
          throw new Error("Missing expected cache item")
        }

        // Use previous value.
        return cacheItem.data.data
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

  private async runGraphqlQuery<T>(query: string): Promise<T> {
    const token = await this.tokenProvider.getToken()
    if (token === undefined) {
      throw new Error("Missing token for GitHub")
    }

    const url = "https://api.github.com/graphql"
    const headers = {
      Authorization: `Bearer ${token}`,
    }

    let requestDuration = -1
    const response = await this.semaphore(() => {
      const requestStart = performance.now()
      const result = fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
        agent: this.config.agent,
      })
      requestDuration = performance.now() - requestStart
      return result
    })

    if (response.status === 401) {
      process.stderr.write("Unauthorized\n")
      await this.tokenProvider.markInvalid()
    }

    // If you get 502 after 10s, it is a timeout.
    if (response.status === 502) {
      throw new Error(
        `Response from Github likely timed out (10s max) after elapsed ${requestDuration}ms with status ${
          response.status
        }: ${await response.text()}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `Response from GitHub not OK (${
          response.status
        }): ${await response.text()}`,
      )
    }

    const json = (await response.json()) as {
      data?: T | null
      errors?: any
    }

    if (json.errors) {
      throw new Error(
        `Error from GitHub GraphQL API: ${JSON.stringify(json.errors)}`,
      )
    }

    if (json.data == null) {
      throw new Error(
        "No data received from GitHub GraphQL API (unknown reason)",
      )
    }

    return json.data
  }

  public async getOrgRepoList({ org }: { org: string }): Promise<Repo[]> {
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

        if (res.organization == null) {
          throw new Error("Missing organization")
        }
        if (res.organization.repositories.nodes == null) {
          throw new Error("Missing organization nodes")
        }

        repos.push(...res.organization.repositories.nodes)

        if (!res.organization.repositories.pageInfo.hasNextPage) {
          break
        }

        after = res.organization.repositories.pageInfo.endCursor
      }

      return repos.sort((a, b) => a.name.localeCompare(b.name))
    })
  }
}

async function createOctokit(
  config: Config,
  tokenProvider: GitHubTokenProvider,
) {
  return new Octokit({
    auth: await tokenProvider.getToken(),
    request: {
      agent: config.agent,
    },
  })
}

interface CreateGitHubServiceProps {
  config: Config
  cache: CacheProvider
  tokenProvider?: GitHubTokenProvider
}

export async function createGitHubService(
  props: CreateGitHubServiceProps,
): Promise<GitHubService> {
  const tokenProvider = props.tokenProvider ?? new GitHubTokenCliProvider()

  return new GitHubService({
    config: props.config,
    octokit: await createOctokit(props.config, tokenProvider),
    cache: props.cache,
    tokenProvider,
  })
}
