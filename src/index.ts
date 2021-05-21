import { version } from "package.json"
import { CacheProvider } from "./cache"
import { Reporter } from "./cli/reporter"
import { createReporter } from "./cli/util"
import { Config } from "./config"
import { DefinitionFile } from "./definition/definition"
import { createGitHubService, GitHubService } from "./github/service"

export const VERSION = version

export * as definition from "./definition"
export * as github from "./github"
export * as loadSecrets from "./load-secrets"
export * as snyk from "./snyk"
export * from "./testing"
// Consider removing old exports later.
export {
  CacheProvider,
  Config,
  createGitHubService,
  createReporter,
  DefinitionFile,
  GitHubService,
  Reporter,
}
