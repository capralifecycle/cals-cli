import { SnykGitHubRepo, SnykProject } from "./types"

export function getGitHubRepo(
  snykProject: SnykProject,
): SnykGitHubRepo | undefined {
  if (snykProject.origin !== "github") {
    return undefined
  }

  const match = snykProject.name.match(/^([^/]+)\/([^:]+):(.+)$/)
  if (match === null) {
    throw Error(`Unexpected value: ${match}`)
  }

  return {
    owner: match[1],
    name: match[2],
    file: match[3],
  }
}

export function getGitHubRepoId(repo: SnykGitHubRepo | undefined) {
  return repo ? `${repo.owner}/${repo.name}` : undefined
}
