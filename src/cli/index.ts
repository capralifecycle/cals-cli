import process from "node:process"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { engines, version } from "../../package.json"
import auth from "./commands/auth"
import clone from "./commands/clone"
import repos from "./commands/repos"
import sync from "./commands/sync"

declare const BUILD_TIMESTAMP: string

function parseVersion(v: string): number[] {
  return v
    .replace(/^[^\d]*/, "")
    .split(".")
    .map(Number)
}

function satisfiesMinVersion(current: string, required: string): boolean {
  const cur = parseVersion(current)
  const req = parseVersion(required.replace(/^>=?\s*/, ""))
  for (let i = 0; i < 3; i++) {
    if ((cur[i] ?? 0) > (req[i] ?? 0)) return true
    if ((cur[i] ?? 0) < (req[i] ?? 0)) return false
  }
  return true
}

export async function main(): Promise<void> {
  if (!satisfiesMinVersion(process.version, engines.node)) {
    console.error(
      `Required node version ${engines.node} not satisfied with current version ${process.version}.`,
    )
    process.exit(1)
  }

  await yargs(hideBin(process.argv))
    .usage(`cals v${version} (build: ${BUILD_TIMESTAMP})

A CLI for managing GitHub repositories.

Before using, authenticate with: cals auth`)
    .scriptName("cals")
    .locale("en")
    .help("help")
    .command(auth)
    .command(clone)
    .command(repos)
    .command(sync)
    .version(version)
    .demandCommand()
    .option("validate-cache", {
      describe: "Bypass cache and fetch fresh data",
      type: "boolean",
    })
    .example("cals auth", "Set GitHub token")
    .example("cals repos --org myorg", "List repositories")
    .example("cals clone --org myorg --all | bash", "Clone all repos")
    .example("cals sync", "Pull latest changes")
    .parse()
}
