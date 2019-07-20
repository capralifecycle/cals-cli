import {
  OrgsListMembersResponseItem,
  OrgsListPendingInvitationsResponseItem,
  TeamsListMembersResponseItem,
  TeamsListPendingInvitationsResponseItem,
} from '@octokit/rest'

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
  sshUrl: string
  repositoryTopics: { edges: { node: { topic: { name: string } } }[] }
}

export type Permission = 'admin' | 'push' | 'pull'

export type TeamMemberOrInvited =
  | {
      type: 'member'
      login: string
      data: TeamsListMembersResponseItem
    }
  | {
      type: 'invited'
      login: string
      data: TeamsListPendingInvitationsResponseItem
    }

export type OrgMemberOrInvited =
  | {
      type: 'member'
      login: string
      data: OrgsListMembersResponseItem
    }
  | {
      type: 'invited'
      login: string
      data: OrgsListPendingInvitationsResponseItem
    }
