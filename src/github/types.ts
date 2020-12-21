import { Endpoints } from "@octokit/types"

export type OrgsGetResponse = Endpoints["GET /orgs/{org}"]["response"]["data"]

export type OrgsListMembersResponseItem = Exclude<
  Endpoints["GET /orgs/{org}/members"]["response"]["data"][0],
  null
>

export type OrgsListPendingInvitationsResponseItem = Endpoints["GET /orgs/{org}/invitations"]["response"]["data"][0]

export type ReposGetResponse = Endpoints["GET /repos/{owner}/{repo}"]["response"]["data"]

export type ReposListTeamsResponseItem = Endpoints["GET /repos/{owner}/{repo}/teams"]["response"]["data"][0]

export type ReposListHooksResponseItem = Endpoints["GET /repos/{owner}/{repo}/hooks"]["response"]["data"][0]

export type ReposUpdateParams = Endpoints["PATCH /repos/{owner}/{repo}"]["parameters"]

export type TeamsListMembersResponseItem = Exclude<
  Endpoints["GET /teams/{team_id}/members"]["response"]["data"][0],
  null
>

export type TeamsListPendingInvitationsResponseItem = Endpoints["GET /teams/{team_id}/invitations"]["response"]["data"][0]

export type TeamsListResponseItem = Endpoints["GET /orgs/{org}/teams"]["response"]["data"][0]

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

// See https://developer.github.com/v4/object/repositoryvulnerabilityalert/
export interface VulnerabilityAlert {
  dismissReason: string | null
  vulnerableManifestFilename: string
  vulnerableManifestPath: string
  vulnerableRequirements: string | null
  securityAdvisory: {
    description: string
    identifiers: Array<{
      type: string
      value: string
    }>
    references: Array<{
      url: string // URI
    }>
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE"
  } | null
  securityVulnerability: {
    package: {
      name: string
      ecosystem:
        | "COMPOSER"
        | "MAVEN"
        | "NPM"
        | "NUGET"
        | "PIP"
        | "RUBYGEMS"
        | string
    }
    firstPatchedVersion: {
      identifier: string
    }
    vulnerableVersionRange: string
  } | null
}

export type Permission = "admin" | "push" | "pull"

export type TeamMemberOrInvited =
  | {
      type: "member"
      login: string
      data: TeamsListMembersResponseItem
    }
  | {
      type: "invited"
      login: string
      data: TeamsListPendingInvitationsResponseItem
    }

export type OrgMemberOrInvited =
  | {
      type: "member"
      login: string
      data: OrgsListMembersResponseItem
    }
  | {
      type: "invited"
      login: string
      data: OrgsListPendingInvitationsResponseItem
    }

export interface RenovateDependencyDashboardIssue {
  number: number
  body: string
  lastUpdatedByRenovate: string | null
}
