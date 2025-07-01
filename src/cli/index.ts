import process from "node:process"
import { engines, version } from "package.json"
import semver from "semver"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import definition from "./commands/definition"
import deleteCache from "./commands/delete-cache"
import gettingStarted from "./commands/getting-started"
import github from "./commands/github"
import snyk from "./commands/snyk"

declare const BUILD_TIMESTAMP: string

export async function main(): Promise<void> {
  if (!semver.satisfies(process.version, engines.node)) {
    console.error(
      `Required node version ${engines.node} not satisfied with current version ${process.version}.`,
    )
    process.exit(1)
  }

  await yargs(hideBin(process.argv))
    .usage(`cals-cli v${version} (build: ${BUILD_TIMESTAMP})`)
    .scriptName("cals")
    .locale("en")
    .help("help")
    .command(deleteCache)
    .command(definition)
    .command(github)
    .command(gettingStarted)
    .command(snyk)
    .version(version)
    .demandCommand()
    .option("non-interactive", {
      describe: "Non-interactive mode",
      type: "boolean",
    })
    .option("verbose", {
      describe: "Verbose output",
      type: "boolean",
    })
    .option("validate-cache", {
      describe: "Only read from cache if validated against server",
      type: "boolean",
    })
    .parse()
}
