import { SnykGitHubRepo, SnykProject } from "./types"

export function getGitHubRepo(
  snykProject: SnykProject,
): SnykGitHubRepo | undefined {
  if (snykProject.origin !== "github") {
    return undefined
  }

  const match = /^([^/]+)\/([^:]+):(.+)$/.exec(snykProject.name)
  if (match === null) {
    throw Error(
      `Could not extract components from Snyk project name: ${snykProject.name} (id: ${snykProject.id})`,
    )
  }

  return {
    owner: match[1],
    name: match[2],
    file: match[3],
  }
}

export function getGitHubRepoId(
  repo: SnykGitHubRepo | undefined,
): string | undefined {
  return repo ? `${repo.owner}/${repo.name}` : undefined
}
