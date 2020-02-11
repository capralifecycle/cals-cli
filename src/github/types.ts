import { Octokit } from "@octokit/rest"

export interface Repo {
  name: string
  owner: {
    login: string
  }
  defaultBranchRef: {
    name: string
  }
  createdAt: string
  updatedAt: string
  isArchived: boolean
  sshUrl: string
  repositoryTopics: { edges: { node: { topic: { name: string } } }[] }
}

export type Permission = "admin" | "push" | "pull"

export type TeamMemberOrInvited =
  | {
      type: "member"
      login: string
      data: Octokit.TeamsListMembersResponseItem
    }
  | {
      type: "invited"
      login: string
      data: Octokit.TeamsListPendingInvitationsResponseItem
    }

export type OrgMemberOrInvited =
  | {
      type: "member"
      login: string
      data: Octokit.OrgsListMembersResponseItem
    }
  | {
      type: "invited"
      login: string
      data: Octokit.OrgsListPendingInvitationsResponseItem
    }
