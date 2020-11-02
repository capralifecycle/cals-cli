import { version } from "package.json"
import { CacheProvider } from "./cache"
import { Reporter } from "./cli/reporter"
import { createReporter } from "./cli/util"
import { Config } from "./config"
import * as definition from "./definition"
import { DefinitionFile } from "./definition/definition"
import { createGitHubService, GitHubService } from "./github/service"

export const VERSION = version

export * from "./testing"
export {
  CacheProvider,
  Config,
  createGitHubService,
  createReporter,
  DefinitionFile,
  definition,
  GitHubService,
  Reporter,
}
