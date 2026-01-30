import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import yargs, { type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import type { Config } from "../../config"
import { createGitHubService, type GitHubService } from "../../github"
import { getGroupedRepos, includesTopic } from "../../github/util"
import { createCacheProvider, createConfig } from "../util"

async function generateCloneCommands({
  config,
  github,
  org,
  ...opt
}: {
  config: Config
  github: GitHubService
  all: boolean
  skipCloned: boolean
  group: string | undefined
  includeArchived: boolean
  name: string | undefined
  topic: string | undefined
  org: string
}) {
  if (!opt.all && opt.group === undefined) {
    yargs(hideBin(process.argv)).showHelp()
    return
  }

  const repos = await github.getOrgRepoList({ org })
  const groups = getGroupedRepos(repos)

  for (const group of groups) {
    if (opt.group !== undefined && opt.group !== group.name) {
      continue
    }

    group.items
      .filter((it) => opt.includeArchived || !it.isArchived)
      .filter((it) => opt.name === undefined || it.name.includes(opt.name))
      .filter((it) => opt.topic === undefined || includesTopic(it, opt.topic))
      .filter(
        (it) =>
          !opt.skipCloned || !fs.existsSync(path.resolve(config.cwd, it.name)),
      )
      .forEach((repo) => {
        // The output of this is used to pipe into e.g. bash.
        process.stdout.write(
          `[ ! -e "${repo.name}" ] && git clone ${repo.sshUrl}\n`,
        )
      })
  }
}

const command: CommandModule = {
  command: "clone [group]",
  describe: "Generate git clone commands (pipe to bash to execute)",
  builder: (yargs) =>
    yargs
      .positional("group", {
        describe: "Clone only repos in this group",
        type: "string",
      })
      .options("org", {
        alias: "o",
        demandOption: true,
        requiresArg: true,
        describe: "GitHub organization",
        type: "string",
      })
      .option("all", {
        describe: "Clone all repos",
        type: "boolean",
      })
      .option("include-archived", {
        alias: "a",
        describe: "Include archived repos",
        type: "boolean",
      })
      .option("name", {
        describe: "Filter to include the specified name",
        type: "string",
        requiresArg: true,
      })
      .option("topic", {
        alias: "t",
        describe: "Filter by specific topic",
        type: "string",
        requiresArg: true,
      })
      .option("skip-cloned", {
        alias: "s",
        describe: "Skip repos already cloned in working directory",
        type: "boolean",
      }),
  handler: async (argv) => {
    const config = createConfig()

    return generateCloneCommands({
      config,
      github: await createGitHubService({
        cache: createCacheProvider(config, argv),
      }),
      all: !!argv.all,
      includeArchived: !!argv["include-archived"],
      name: argv.name as string | undefined,
      topic: argv.topic as string | undefined,
      skipCloned: !!argv["skip-cloned"],
      group: argv.group as string | undefined,
      org: argv.org as string,
    })
  },
}

export default command
