import {
  OrgsGetResponse,
  ReposUpdateParams,
  TeamsListResponseItem,
} from "@octokit/rest"
import { Reporter } from "../../cli/reporter"
import { GitHubService } from "../service"
import { ChangeSetItem } from "./types"

function buildLookup(github: GitHubService) {
  // We operate using the Octokit SDK, so cache the objects to avoid
  // excessive lookups to the API for them.

  const orgCache: Record<string, OrgsGetResponse> = {}
  const orgTeamListCache: Record<string, TeamsListResponseItem[]> = {}

  async function getOrg(orgName: string) {
    if (!(orgName in orgCache)) {
      orgCache[orgName] = await github.getOrg(orgName)
    }

    return orgCache[orgName]
  }

  async function getOrgTeamList(orgName: string) {
    if (!(orgName in orgTeamListCache)) {
      const org = await getOrg(orgName)
      orgTeamListCache[orgName] = await github.getTeamList(org)
    }

    return orgTeamListCache[orgName]
  }

  async function getOrgTeam(orgName: string, teamName: string) {
    const teams = await getOrgTeamList(orgName)
    const team = teams.find(it => it.name === teamName)
    if (team === undefined) {
      throw new Error(`Team ${orgName}/${teamName} not found`)
    }
    return team
  }

  return {
    getOrgTeam,
  }
}

/**
 * Execute a change set item.
 */
async function executeChangeSetItem(
  github: GitHubService,
  changeItem: ChangeSetItem,
  reporter: Reporter,
  lookup: ReturnType<typeof buildLookup>,
): Promise<true> {
  // We return to ensure all code paths are followed during compiling.
  // If a change item type is missing we will get a compile error.

  switch (changeItem.type) {
    case "repo-create":
    case "repo-delete":
      reporter.warn("Not currently implemented - do it manually")
      return true

    case "member-remove":
      await github.octokit.orgs.removeMembership({
        org: changeItem.org,
        username: changeItem.user,
      })
      return true

    case "member-add":
      await github.octokit.orgs.addOrUpdateMembership({
        org: changeItem.org,
        username: changeItem.user,
        role: "member",
      })
      return true

    case "team-remove":
      await github.octokit.teams.deleteInOrg({
        org: changeItem.org,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
      })
      return true

    case "team-add":
      await github.octokit.teams.create({
        org: changeItem.org,
        name: changeItem.team,
        privacy: "closed",
      })
      return true

    case "team-member-permission":
      await github.octokit.teams.addOrUpdateMembershipInOrg({
        org: changeItem.org,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
        username: changeItem.user,
        role: changeItem.role,
      })
      return true

    case "team-member-remove":
      await github.octokit.teams.removeMembershipInOrg({
        org: changeItem.org,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
        username: changeItem.user,
      })
      return true

    case "team-member-add":
      await github.octokit.teams.addOrUpdateMembershipInOrg({
        org: changeItem.org,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
        username: changeItem.user,
      })
      return true

    case "repo-update":
      const upd: ReposUpdateParams = {
        owner: changeItem.org,
        repo: changeItem.repo,
      }

      for (const attrib of changeItem.attribs) {
        if ("archived" in attrib) {
          upd.archived = attrib["archived"]
        } else if ("issues" in attrib) {
          upd.has_issues = attrib["issues"]
        } else if ("wiki" in attrib) {
          upd.has_wiki = attrib["wiki"]
        } else if ("private" in attrib) {
          upd.private = attrib["private"]
        }
      }

      await github.octokit.repos.update(upd)
      return true

    case "repo-team-remove":
      await github.octokit.teams.removeRepoInOrg({
        org: changeItem.org,
        owner: changeItem.org,
        repo: changeItem.repo,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
      })
      return true

    case "repo-team-add":
    case "repo-team-permission":
      await github.octokit.teams.addOrUpdateRepoInOrg({
        org: changeItem.org,
        owner: changeItem.org,
        repo: changeItem.repo,
        team_slug: (await lookup.getOrgTeam(changeItem.org, changeItem.team))
          .slug,
        permission: changeItem.permission,
      })
      return true
  }
}

/**
 * Execute a change set.
 */
export async function executeChangeSet(
  github: GitHubService,
  changes: ChangeSetItem[],
  reporter: Reporter,
) {
  const lookup = buildLookup(github)
  for (const changeItem of changes) {
    reporter.info(`Executing ${JSON.stringify(changeItem)}`)
    await executeChangeSetItem(github, changeItem, reporter, lookup)
  }
}
