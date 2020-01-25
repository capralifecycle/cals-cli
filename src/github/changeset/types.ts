import { Permission } from "../types"

// GitHub repos

interface RepoCreateItem {
  type: "repo-create"
  org: string
  repo: string
}

interface RepoDeleteItem {
  type: "repo-delete"
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

interface RepoTeamAddItem {
  type: "repo-team-add"
  org: string
  repo: string
  team: string
  permission: Permission
}

interface RepoTeamRemoveItem {
  type: "repo-team-remove"
  org: string
  repo: string
  team: string
}

interface RepoTeamPermissionItem {
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

interface MemberRemoveItem {
  type: "member-remove"
  org: string
  user: string
}

interface MemberAddItem {
  type: "member-add"
  org: string
  user: string
}

// GitHub teams

interface TeamRemoveItem {
  type: "team-remove"
  org: string
  team: string
}

interface TeamAddItem {
  type: "team-add"
  org: string
  team: string
}

interface TeamMemberRemoveItem {
  type: "team-member-remove"
  org: string
  team: string
  user: string
}

interface TeamMemberAddItem {
  type: "team-member-add"
  org: string
  team: string
  user: string
  role: "member" | "maintainer"
}

interface TeamMemberPermissionItem {
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
  | RepoDeleteItem
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
