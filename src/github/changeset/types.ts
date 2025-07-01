import type { Permission } from "../types"

// GitHub repos

export interface RepoCreateItem {
  type: "repo-create"
  org: string
  repo: string
}

export interface RepoAttribUpdateItem {
  type: "repo-update"
  org: string
  repo: string
  attribs: (
    | { archived: boolean }
    | { issues: boolean }
    | { wiki: boolean }
    | { private: boolean }
  )[]
}

export interface RepoTeamAddItem {
  type: "repo-team-add"
  org: string
  repo: string
  team: string
  permission: Permission
}

export interface RepoTeamRemoveItem {
  type: "repo-team-remove"
  org: string
  repo: string
  team: string
}

export interface RepoTeamPermissionItem {
  type: "repo-team-permission"
  org: string
  repo: string
  team: string
  permission: Permission
  current: {
    permission: Permission
  }
}

// GitHub members

export interface MemberRemoveItem {
  type: "member-remove"
  org: string
  user: string
}

export interface MemberAddItem {
  type: "member-add"
  org: string
  user: string
}

// GitHub teams

export interface TeamRemoveItem {
  type: "team-remove"
  org: string
  team: string
}

export interface TeamAddItem {
  type: "team-add"
  org: string
  team: string
}

export interface TeamMemberRemoveItem {
  type: "team-member-remove"
  org: string
  team: string
  user: string
}

export interface TeamMemberAddItem {
  type: "team-member-add"
  org: string
  team: string
  user: string
  role: "member" | "maintainer"
}

export interface TeamMemberPermissionItem {
  type: "team-member-permission"
  org: string
  team: string
  user: string
  role: "member" | "maintainer"
}

/**
 * A change set item describes a transition on the end
 * service to become in sync with the desired definition.
 */
export type ChangeSetItem =
  | RepoCreateItem
  | RepoAttribUpdateItem
  | RepoTeamPermissionItem
  | RepoTeamAddItem
  | RepoTeamRemoveItem
  | MemberAddItem
  | MemberRemoveItem
  | TeamRemoveItem
  | TeamAddItem
  | TeamMemberRemoveItem
  | TeamMemberAddItem
  | TeamMemberPermissionItem
