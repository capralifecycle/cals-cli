import {
  OrgsGetResponse,
  ReposGetResponse,
  TeamsListResponseItem,
} from "@octokit/rest"
import { sortBy } from "lodash"
import pMap from "p-map"
import { getGitHubOrgs, getRepos } from "../../definition/definition"
import {
  Definition,
  DefinitionRepo,
  Project,
  Team,
} from "../../definition/types"
import { GitHubService } from "../service"
import { Permission } from "../types"
import { ChangeSetItem, RepoAttribUpdateItem } from "./types"

type GetOrg = (
  orgName: string,
) => Promise<{
  org: OrgsGetResponse
  teams: TeamsListResponseItem[]
}>

function getChangedRepoAttribs(
  definitionRepo: DefinitionRepo,
  actualRepo: ReposGetResponse,
) {
  const attribs: RepoAttribUpdateItem["attribs"] = []

  const archived = definitionRepo.archived || false
  if (archived !== actualRepo.archived) {
    attribs.push({
      archived,
    })
  }

  const issues = definitionRepo.issues || true
  if (issues !== actualRepo.has_issues && !actualRepo.archived) {
    attribs.push({
      issues,
    })
  }

  const wiki = definitionRepo.wiki || true
  if (wiki !== actualRepo.has_wiki && !actualRepo.archived) {
    attribs.push({
      wiki,
    })
  }

  const isPrivate = definitionRepo.public !== true
  if (isPrivate !== actualRepo.private) {
    attribs.push({
      private: isPrivate,
    })
  }

  return attribs
}

async function getUnknownRepos(
  github: GitHubService,
  definition: Definition,
  limitToOrg: string | null,
) {
  const knownRepos = getRepos(definition).map(it => it.id)
  const orgs = getGitHubOrgs(definition).filter(
    orgName => limitToOrg === null || limitToOrg === orgName,
  )

  return sortBy(
    (await pMap(orgs, orgName => github.getRepoList({ owner: orgName })))
      .flat()
      .filter(it => !knownRepos.includes(`${it.owner.login}/${it.name}`)),
    it => `${it.owner.login}/${it.name}`,
  )
}

async function getRepoTeamChanges({
  github,
  org,
  projectRepo,
  repo,
}: {
  github: GitHubService
  org: Project["github"][0]
  projectRepo: DefinitionRepo
  repo: ReposGetResponse
}) {
  const changes: ChangeSetItem[] = []
  const expectedTeams = [...(org.teams || []), ...(projectRepo.teams || [])]
  const existingTeams = await github.getRepositoryTeamsList(repo)

  // Check for teams to be added / modified.
  for (const repoteam of expectedTeams) {
    const found = existingTeams.find(it => repoteam.name === it.name)
    if (found !== undefined) {
      if (found.permission !== repoteam.permission) {
        changes.push({
          type: "repo-team-permission",
          org: org.organization,
          repo: repo.name,
          team: found.name,
          permission: repoteam.permission,
          current: {
            permission: found.permission as Permission,
          },
        })
      }
    } else {
      changes.push({
        type: "repo-team-add",
        org: org.organization,
        repo: repo.name,
        team: repoteam.name,
        permission: repoteam.permission,
      })
    }
  }

  // Check for teams that should not be registered.
  for (const team of existingTeams) {
    if (!expectedTeams.some(it => team.name === it.name)) {
      changes.push({
        type: "repo-team-remove",
        org: org.organization,
        repo: repo.name,
        team: team.name,
      })
    }
  }

  return changes
}

async function getProjectRepoChanges({
  github,
  org,
  projectRepo,
}: {
  github: GitHubService
  org: Project["github"][0]
  projectRepo: DefinitionRepo
}) {
  const changes: ChangeSetItem[] = []

  const repo = await github.getRepository(org.organization, projectRepo.name)
  if (repo === undefined) {
    changes.push({
      type: "repo-create",
      org: org.organization,
      repo: projectRepo.name,
    })
    return changes
  }

  const attribs = getChangedRepoAttribs(projectRepo, repo)
  if (attribs.length > 0) {
    changes.push({
      type: "repo-update",
      org: org.organization,
      repo: repo.name,
      attribs,
    })
  }

  changes.push(
    ...(await getRepoTeamChanges({
      github,
      org,
      projectRepo,
      repo,
    })),
  )

  return changes
}

/**
 * Generate change set items for projects.
 */
export async function createChangeSetItemsForProjects(
  github: GitHubService,
  definition: Definition,
  limitToOrg: string | null,
) {
  const changes: ChangeSetItem[] = []

  const orgs = definition.projects
    .flatMap(it => it.github)
    .filter(org => limitToOrg === null || limitToOrg === org.organization)

  changes.push(
    ...(
      await pMap(orgs, async org =>
        pMap(org.repos || [], projectRepo =>
          getProjectRepoChanges({
            github,
            org,
            projectRepo,
          }),
        ),
      )
    )
      .flat()
      .flat(),
  )

  const unknownRepos = await getUnknownRepos(github, definition, limitToOrg)
  for (const it of unknownRepos) {
    changes.push({
      type: "repo-delete",
      org: it.owner.login,
      repo: it.name,
    })
  }

  return changes
}

/**
 * Get user list based on team memberships in an organization.
 */
function getUsersForOrg(definition: Definition, org: string) {
  const teams = definition.github.teams.find(it => it.organization == org)
  if (teams === undefined) return []

  const memberLogins = new Set(teams.teams.flatMap(it => it.members))
  return definition.github.users.filter(user => memberLogins.has(user.login))
}

/**
 * Generate change set items for organization members.
 */
export async function createChangeSetItemsForMembers(
  github: GitHubService,
  definition: Definition,
  org: OrgsGetResponse,
) {
  const changes: ChangeSetItem[] = []
  const users = getUsersForOrg(definition, org.login)

  const usersLogins = users.map(it => it.login)
  const foundLogins: string[] = []

  const members = await github.getOrgMembersListIncludingInvited(org.login)
  members.forEach(user => {
    if (usersLogins.includes(user.login)) {
      foundLogins.push(user.login)
    } else {
      changes.push({
        type: "member-remove",
        org: org.login,
        user: user.login,
      })
    }
  })

  for (const user of users.filter(it => !foundLogins.includes(it.login))) {
    changes.push({
      type: "member-add",
      org: org.login,
      user: user.login,
    })
  }

  return changes
}

/**
 * Generate change set items for organization teams.
 */
export async function createChangeSetItemsForTeams(
  github: GitHubService,
  definition: Definition,
  org: OrgsGetResponse,
) {
  const changes: ChangeSetItem[] = []

  const teams = (
    definition.github.teams.find(it => it.organization === org.login) || {
      teams: [] as Team[],
    }
  ).teams

  const actualTeams = await github.getTeamList(org)
  const actualTeamNames = actualTeams.map(it => it.name)
  const wantedTeamNames = teams.map(it => it.name)

  actualTeams
    .filter(it => !wantedTeamNames.includes(it.name))
    .forEach(it => {
      changes.push({
        type: "team-remove",
        org: org.login,
        team: it.name,
      })
    })

  teams
    .filter(it => !actualTeamNames.includes(it.name))
    .forEach(team => {
      changes.push({
        type: "team-add",
        org: org.login,
        team: team.name,
      })

      // Must add all members when creating new team.
      for (const member of team.members) {
        changes.push({
          type: "team-member-add",
          org: org.login,
          team: team.name,
          user: member,
          // TODO: Allow to specify maintainers?
          role: "member",
        })
      }
    })

  const overlappingTeams = actualTeams.filter(it =>
    wantedTeamNames.includes(it.name),
  )

  await pMap(overlappingTeams, async actualTeam => {
    const wantedTeam = teams.find(it => it.name === actualTeam.name)!
    const actualMembers = await github.getTeamMemberListIncludingInvited(
      org,
      actualTeam,
    )

    actualMembers
      .filter(it => !wantedTeam.members.includes(it.login))
      .forEach(it => {
        changes.push({
          type: "team-member-remove",
          org: org.login,
          team: actualTeam.name,
          user: it.login,
        })
      })

    const actualMembersNames = actualMembers.map(it => it.login)

    wantedTeam.members
      .filter(it => !actualMembersNames.includes(it))
      .forEach(it => {
        changes.push({
          type: "team-member-add",
          org: org.login,
          team: actualTeam.name,
          user: it,
          // TODO: Allow to specify maintainers?
          role: "member",
        })
      })

    // TODO: team-member-permission (member/maintainer)
  })

  return changes
}

/**
 * Remove redundant change set items due to effects by other
 * change set items.
 */
export function cleanupChangeSetItems(items: ChangeSetItem[]) {
  const hasTeamRemove = ({ org, team }: { org: string; team: string }) =>
    items.some(
      it => it.type === "team-remove" && it.org === org && it.team === team,
    )

  const hasMemberRemove = ({ org }: { org: string }) =>
    items.some(it => it.type === "member-remove" && it.org === org)

  return items.filter(
    item =>
      !(
        (item.type === "team-member-remove" && hasTeamRemove(item)) ||
        (item.type === "repo-team-remove" && hasTeamRemove(item)) ||
        (item.type === "team-member-remove" && hasMemberRemove(item))
      ),
  )
}
