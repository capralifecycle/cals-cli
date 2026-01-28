import process from "node:process"
import semver from "semver"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { engines, version } from "../../package.json"
import github from "./commands/github"

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
    .command(github)
    .version(version)
    .demandCommand()
    .option("validate-cache", {
      describe: "Only read from cache if validated against server",
      type: "boolean",
    })
    .parse()
}
