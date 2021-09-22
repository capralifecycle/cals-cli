import { SnykGitHubRepo, SnykProject } from "./types"

export function getGitHubRepo(
  snykProject: SnykProject,
): SnykGitHubRepo | undefined {
  if (snykProject.origin === "github") {
    const match = /^([^/]+)\/([^:]+)(:(.+))?$/.exec(snykProject.name)
    if (match === null) {
      throw Error(
        `Could not extract components from Snyk project name: ${snykProject.name} (id: ${snykProject.id})`,
      )
    }

    return {
      owner: match[1],
      name: match[2],
    }
  } else if (
    snykProject.origin === "cli" &&
    snykProject.remoteRepoUrl != null
  ) {
    // The remoteRepoUrl can be overriden when using the CLI, so don't
    // fail if we cannot extract the value.

    const match = /github.com\/([^/]+)\/(.+)\.git$/.exec(
      snykProject.remoteRepoUrl,
    )
    if (match === null) {
      return undefined
    }

    return {
      owner: match[1],
      name: match[2],
    }
  } else {
    return undefined
  }
}

export function getGitHubRepoId(
  repo: SnykGitHubRepo | undefined,
): string | undefined {
  return repo ? `${repo.owner}/${repo.name}` : undefined
}
