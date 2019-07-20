import { OrgsGetResponse, TeamsListResponseItem } from '@octokit/rest'
import { sortBy } from 'lodash'
import { getGitHubOrgs, getRepos } from '../../definition/definition'
import { Definition, Team } from '../../definition/types'
import { GitHubService } from '../service'
import { Permission, Repo } from '../types'
import { ChangeSetItem, RepoAttribUpdateItem } from './types'

/**
 * Generate change set items for projects.
 */
export async function createChangeSetItemsForProjects(
  github: GitHubService,
  definition: Definition,
  getOrg: (
    orgName: string,
  ) => Promise<{
    org: OrgsGetResponse
    teams: TeamsListResponseItem[]
  }>,
  limitToOrg: string | null,
) {
  const changes: ChangeSetItem[] = []

  for (const project of definition.projects) {
    for (const org of project.github) {
      if (limitToOrg !== null && limitToOrg !== org.organization) {
        continue
      }

      const { teams } = await getOrg(org.organization)

      for (const projectRepo of org.repos || []) {
        const repo = await github.getRepository(
          org.organization,
          projectRepo.name,
        )
        if (repo === undefined) {
          changes.push({
            type: 'repo-create',
            org: org.organization,
            repo: projectRepo.name,
          })
          continue
        }

        // Check for changed attributes on repo.

        const attribs: RepoAttribUpdateItem['attribs'] = []

        if (
          projectRepo.archived !== undefined &&
          projectRepo.archived !== repo.archived
        ) {
          attribs.push({
            archived: projectRepo.archived,
          })
        }

        if (
          projectRepo.issues !== undefined &&
          projectRepo.issues !== repo.has_issues &&
          !repo.archived
        ) {
          attribs.push({
            issues: projectRepo.issues,
          })
        }

        if (
          projectRepo.wiki !== undefined &&
          projectRepo.wiki !== repo.has_wiki &&
          !repo.archived
        ) {
          attribs.push({
            wiki: projectRepo.wiki,
          })
        }

        const isPrivate = projectRepo.public !== true
        if (isPrivate !== repo.private) {
          attribs.push({
            private: isPrivate,
          })
        }

        if (attribs.length > 0) {
          changes.push({
            type: 'repo-update',
            org: org.organization,
            repo: repo.name,
            attribs,
          })
        }

        const expectedTeams = [
          ...(org.teams || []),
          ...(projectRepo.teams || []),
        ]
        const existingTeams = await github.getRepositoryTeamsList(repo)

        // Check for teams to be added / modified.
        for (const repoteam of expectedTeams) {
          const found = existingTeams.find(it => repoteam.name === it.name)
          if (found !== undefined) {
            if (found.permission !== repoteam.permission) {
              changes.push({
                type: 'repo-team-permission',
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
            const team = teams.find(it => repoteam.name === it.name)
            if (team === undefined) {
              throw Error(`Unknown team: ${repoteam.name}`)
            }

            changes.push({
              type: 'repo-team-add',
              org: org.organization,
              repo: repo.name,
              team: team.name,
              permission: repoteam.permission,
            })
          }
        }

        // Check for teams that should not be registered.
        for (const team of existingTeams) {
          if (!expectedTeams.some(it => team.name === it.name)) {
            changes.push({
              type: 'repo-team-remove',
              org: org.organization,
              repo: repo.name,
              team: team.name,
            })
          }
        }
      }
    }
  }

  const knownRepos = getRepos(definition).map(it => it.id)

  const allRepos: Repo[] = []
  for (const orgName of getGitHubOrgs(definition)) {
    if (limitToOrg !== null && limitToOrg !== orgName) {
      continue
    }

    const repos = await github.getRepoList({ owner: orgName })
    allRepos.push(...repos)
  }

  const unknownRepos = sortBy(
    allRepos.filter(it => !knownRepos.includes(`${it.owner.login}/${it.name}`)),
    it => `${it.owner.login}/${it.name}`,
  )

  for (const it of unknownRepos) {
    changes.push({
      type: 'repo-delete',
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

  const members = await github.getOrgMembersList(org.login)
  members.forEach(user => {
    if (usersLogins.includes(user.login)) {
      foundLogins.push(user.login)
    } else {
      changes.push({
        type: 'member-remove',
        org: org.login,
        user: user.login,
      })
    }
  })

  for (const user of users.filter(it => !foundLogins.includes(it.login))) {
    changes.push({
      type: 'member-add',
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
        type: 'team-remove',
        org: org.login,
        team: it.name,
      })
    })

  teams
    .filter(it => !actualTeamNames.includes(it.name))
    .forEach(team => {
      changes.push({
        type: 'team-add',
        org: org.login,
        team: team.name,
      })

      for (const member of team.members) {
        changes.push({
          type: 'team-member-add',
          org: org.login,
          team: team.name,
          user: member,
        })
      }
    })

  const overlappingTeams = actualTeams.filter(it =>
    wantedTeamNames.includes(it.name),
  )
  for (const actualTeam of overlappingTeams) {
    const wantedTeam = teams.find(it => it.name === actualTeam.name)!
    const actualMembers = await github.getTeamMemberList(actualTeam)

    actualMembers
      .filter(it => !wantedTeam.members.includes(it.login))
      .forEach(it => {
        changes.push({
          type: 'team-member-remove',
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
          type: 'team-member-add',
          org: org.login,
          team: actualTeam.name,
          user: it,
        })
      })
  }

  return changes
}
