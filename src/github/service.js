import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import pLimit from "p-limit";
import { GitHubTokenCliProvider } from "./token";
import { undefinedForNotFound } from "./util";
export class GitHubService {
    config;
    octokit;
    cache;
    tokenProvider;
    semaphore;
    constructor(props) {
        this.config = props.config;
        this.octokit = props.octokit;
        this.cache = props.cache;
        this.tokenProvider = props.tokenProvider;
        // Control concurrency to GitHub API at service level so we
        // can maximize concurrency all other places.
        this.semaphore = pLimit(6);
        this.octokit.hook.wrap("request", async (request, options) => {
            /* eslint-disable @typescript-eslint/no-unsafe-member-access */
            this._requestCount++;
            if (options.method !== "GET") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return this.semaphore(() => request(options));
            }
            // Try to cache ETag for GET requests to save on rate limiting.
            // Hits on ETag does not count towards rate limiting.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const rest = {
                ...options,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            };
            delete rest.method;
            delete rest.baseUrl;
            delete rest.headers;
            delete rest.mediaType;
            delete rest.request;
            // Build a key that is used to identify this request.
            const key = Buffer.from(JSON.stringify(rest)).toString("base64");
            const cacheItem = this.cache.retrieveJson(key);
            if (cacheItem !== undefined) {
                // Copying doesn't work, seems we need to mutate this.
                options.headers["If-None-Match"] = cacheItem.data.etag;
            }
            const getResponse = async (allowRetry = true) => {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return await request(options);
                }
                catch (e) {
                    // Handle no change in ETag.
                    if (e.status === 304) {
                        return undefined;
                    }
                    // GitHub seems to throw a lot of 502 errors.
                    // Let's give it a few seconds and retry one time.
                    if (e.status === 502 && allowRetry) {
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        return await getResponse(false);
                    }
                    throw e;
                }
            };
            const response = await this.semaphore(async () => {
                return getResponse();
            });
            if (response === undefined) {
                // Undefined is returned for cached data.
                if (cacheItem === undefined) {
                    throw new Error("Missing expected cache item");
                }
                // Use previous value.
                return cacheItem.data.data;
            }
            // New value. Store Etag.
            if (response.headers.etag) {
                this.cache.storeJson(key, {
                    etag: response.headers.etag,
                    data: response,
                });
            }
            return response;
            /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        });
    }
    _requestCount = 0;
    get requestCount() {
        return this._requestCount;
    }
    async runGraphqlQuery(query) {
        const token = await this.tokenProvider.getToken();
        if (token === undefined) {
            throw new Error("Missing token for GitHub");
        }
        const url = "https://api.github.com/graphql";
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        const response = await this.semaphore(() => fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ query }),
            agent: this.config.agent,
        }));
        if (response.status === 401) {
            process.stderr.write("Unauthorized\n");
            await this.tokenProvider.markInvalid();
        }
        if (!response.ok) {
            throw new Error(`Response from GitHub not OK (${response.status}): ${JSON.stringify(response)}`);
        }
        const json = (await response.json());
        if (!!json.errors) {
            throw new Error(`Error from GitHub GraphQL API: ${JSON.stringify(json.errors)}`);
        }
        if (json.data == null) {
            throw new Error(`No data received from GitHub GraphQL API (unknown reason)`);
        }
        return json.data;
    }
    async getOrgRepoList({ org }) {
        const getQuery = (after) => `{
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
}`;
        return this.cache.json(`repos-${org}`, async () => {
            const repos = [];
            let after = null;
            while (true) {
                const query = getQuery(after);
                const res = await this.runGraphqlQuery(query);
                if (res.organization == null) {
                    throw new Error("Missing organization");
                }
                if (res.organization.repositories.nodes == null) {
                    throw new Error("Missing organization nodes");
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                repos.push(...res.organization.repositories.nodes);
                if (!res.organization.repositories.pageInfo.hasNextPage) {
                    break;
                }
                after = res.organization.repositories.pageInfo.endCursor;
            }
            return repos.sort((a, b) => a.name.localeCompare(b.name));
        });
    }
    async getOrgMembersList(org) {
        const options = this.octokit.orgs.listMembers.endpoint.merge({
            org,
        });
        return ((await undefinedForNotFound(this.octokit.paginate(options))) || []);
    }
    async getOrgMembersInvitedList(org) {
        const options = this.octokit.orgs.listPendingInvitations.endpoint.merge({
            org,
        });
        return ((await undefinedForNotFound(this.octokit.paginate(options))) || []);
    }
    async getOrgMembersListIncludingInvited(org) {
        return [
            ...(await this.getOrgMembersList(org)).map((it) => ({
                type: "member",
                login: it.login,
                data: it,
            })),
            ...(await this.getOrgMembersInvitedList(org)).map((it) => ({
                type: "invited",
                // TODO: Fix ?? case properly
                login: it.login ?? "invalid",
                data: it,
            })),
        ];
    }
    async getRepository(owner, repo) {
        return this.cache.json(`get-repository-${owner}-${repo}`, async () => {
            const response = await undefinedForNotFound(this.octokit.repos.get({
                owner,
                repo,
            }));
            return response === undefined ? undefined : response.data;
        });
    }
    async getRepositoryTeamsList(repo) {
        return this.cache.json(`repository-teams-list-${repo.id}`, async () => {
            const options = this.octokit.repos.listTeams.endpoint.merge({
                owner: repo.owner.login,
                repo: repo.name,
            });
            return ((await undefinedForNotFound(this.octokit.paginate(options))) || []);
        });
    }
    async getRepositoryHooks(owner, repo) {
        return this.cache.json(`repository-hooks-${owner}-${repo}`, async () => {
            const options = this.octokit.repos.listWebhooks.endpoint.merge({
                owner,
                repo,
            });
            return ((await undefinedForNotFound(this.octokit.paginate(options))) || []);
        });
    }
    async getOrg(org) {
        const orgResponse = await this.octokit.orgs.get({
            org,
        });
        return orgResponse.data;
    }
    async getTeamList(org) {
        return this.cache.json(`team-list-${org.login}`, async () => {
            const options = this.octokit.teams.list.endpoint.merge({
                org: org.login,
            });
            return (await this.octokit.paginate(options));
        });
    }
    async getTeamMemberList(org, team) {
        return this.cache.json(`team-member-list-${team.id}`, async () => {
            const options = this.octokit.teams.listMembersInOrg.endpoint.merge({
                org: org.login,
                team_slug: team.slug,
            });
            return (await this.octokit.paginate(options));
        });
    }
    async getTeamMemberInvitedList(org, team) {
        return this.cache.json(`team-member-invited-list-${team.id}`, async () => {
            const options = this.octokit.teams.listPendingInvitationsInOrg.endpoint.merge({
                org: org.login,
                team_slug: team.slug,
            });
            return (await this.octokit.paginate(options));
        });
    }
    async getTeamMemberListIncludingInvited(org, team) {
        return [
            ...(await this.getTeamMemberList(org, team)).map((it) => ({
                type: "member",
                login: it.login,
                data: it,
            })),
            ...(await this.getTeamMemberInvitedList(org, team)).map((it) => ({
                type: "invited",
                // TODO: Fix ?? case properly
                login: it.login ?? "invalid",
                data: it,
            })),
        ];
    }
    async getSearchedPullRequestList() {
        // NOTE: Changes to this must by synced with SearchedPullRequestListQueryResult.
        const getQuery = (after) => `{
  search(
    query: "is:open is:pr user:capralifecycle user:capraconsulting archived:false",
    type: ISSUE,
    first: 100${after === null
            ? ""
            : `,
    after: "${after}"`}
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
}`;
        const pulls = [];
        let after = null;
        while (true) {
            const query = getQuery(after);
            const res = await this.runGraphqlQuery(query);
            pulls.push(...res.search.edges.map((it) => it.node));
            if (!res.search.pageInfo.hasNextPage) {
                break;
            }
            after = res.search.pageInfo.endCursor;
        }
        return pulls.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    async getHasVulnerabilityAlertsEnabled(owner, repo) {
        try {
            const response = await this.octokit.repos.checkVulnerabilityAlerts({
                owner: owner,
                repo: repo,
            });
            if (response.status !== 204) {
                console.log(response);
                throw new Error("Unknown response - see previous log line");
            }
            return true;
        }
        catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (e.status === 404) {
                return false;
            }
            throw e;
        }
    }
    async enableVulnerabilityAlerts(owner, repo) {
        await this.octokit.repos.enableVulnerabilityAlerts({
            owner: owner,
            repo: repo,
        });
    }
    /**
     * Get the vulnerability alerts for a repository.
     */
    async getVulnerabilityAlerts(owner, repo) {
        // NOTE: Changes to this must by synced with VulnerabilityAlertsQueryResult.
        const getQuery = (after) => `{
  repository(owner: "${owner}", name: "${repo}") {
    vulnerabilityAlerts(first: 100${after === null ? "" : `, after: "${after}"`}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          state
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
}`;
        return this.cache.json(`vulnerability-alerts-${owner}-${repo}`, async () => {
            const result = [];
            let after = null;
            while (true) {
                const query = getQuery(after);
                const res = await this.runGraphqlQuery(query);
                result.push(...(res.repository?.vulnerabilityAlerts.edges?.map((it) => it.node) ?? []));
                if (!res.repository?.vulnerabilityAlerts.pageInfo.hasNextPage) {
                    break;
                }
                after = res.repository?.vulnerabilityAlerts.pageInfo.endCursor;
            }
            return result;
        });
    }
    /**
     * Get the Renovate Dependency Dashboard issue.
     */
    async getRenovateDependencyDashboardIssue(owner, repo) {
        // NOTE: Changes to this must by synced with RenovateDependencyDashboardIssueQueryResult.
        const getQuery = (after) => `{
  repository(owner: "${owner}", name: "${repo}") {
    issues(
      orderBy: {field: UPDATED_AT, direction: DESC},
      filterBy: {createdBy: "renovate[bot]"},
      states: [OPEN],
      first: 100${after === null ? "" : `, after: "${after}"`}
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          number
          state
          title
          body
          userContentEdits(first: 5) {
            nodes {
              createdAt
              editor {
                login
              }
            }
          }
        }
      }
    }
  }
}`;
        const issues = await this.cache.json(`renovate-bot-issues-${owner}-${repo}`, async () => {
            const result = [];
            let after = null;
            while (true) {
                const query = getQuery(after);
                const res = await this.runGraphqlQuery(query);
                const nodes = res.repository?.issues.edges?.map((it) => it.node) ?? [];
                result.push(...nodes
                    .filter((it) => it.title === "Dependency Dashboard")
                    .map((it) => ({
                    number: it.number,
                    body: it.body,
                    lastUpdatedByRenovate: it.userContentEdits?.nodes?.filter((it) => it.editor?.login === "renovate")?.[0]?.createdAt ?? null,
                })));
                if (!res.repository?.issues.pageInfo.hasNextPage) {
                    break;
                }
                after = res.repository?.issues.pageInfo.endCursor;
            }
            return result;
        });
        if (issues.length == 0) {
            return undefined;
        }
        return issues[0];
    }
}
async function createOctokit(config, tokenProvider) {
    return new Octokit({
        auth: await tokenProvider.getToken(),
        request: {
            agent: config.agent,
        },
    });
}
export async function createGitHubService(props) {
    const tokenProvider = props.tokenProvider ?? new GitHubTokenCliProvider();
    return new GitHubService({
        config: props.config,
        octokit: await createOctokit(props.config, tokenProvider),
        cache: props.cache,
        tokenProvider,
    });
}
