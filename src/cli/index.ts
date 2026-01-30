import process from "node:process"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { engines, version } from "../../package.json"
import github from "./commands/github"

declare const BUILD_TIMESTAMP: string

function parseVersion(v: string): number[] {
  return v.replace(/^[^\d]*/, "").split(".").map(Number)
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
