import { version } from "package.json"
import { CacheProvider } from "./cache"
import { Reporter } from "./cli/reporter"
import { createReporter } from "./cli/util"
import { Config } from "./config"
import * as definition from "./definition"
import { DefinitionFile } from "./definition/definition"
import * as github from "./github"
import { createGitHubService, GitHubService } from "./github/service"

export const VERSION = version

export * as snyk from "./snyk"
export * from "./testing"
// Consider removing old exports later.
export {
  CacheProvider,
  Config,
  createGitHubService,
  createReporter,
  DefinitionFile,
  definition,
  github,
  GitHubService,
  Reporter,
}
