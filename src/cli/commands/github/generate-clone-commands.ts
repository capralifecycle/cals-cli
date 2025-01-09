import fs from "fs"
import path from "path"
import { sprintf } from "sprintf-js"
import yargs, { CommandModule } from "yargs"
import { createCacheProvider, createConfig, createReporter } from "../../util"
import { Config } from "../../../config"
import { createGitHubService, GitHubService } from "../../../github"

import { getGroupedRepos, includesTopic } from "../../../github/util"
import { Reporter } from "../../reporter"
import { hideBin } from "yargs/helpers"

async function generateCloneCommands({
  reporter,
  config,
  github,
  org,
  ...opt
}: {
  reporter: Reporter
  config: Config
  github: GitHubService
  all: boolean
  excludeExisting: boolean
  group: string | undefined
  includeArchived: boolean
  listGroups: boolean
  name: string | undefined
  topic: string | undefined
  org: string
}) {
  if (!opt.listGroups && !opt.all && opt.group === undefined) {
    yargs(hideBin(process.argv)).showHelp()
    return
  }

  const repos = await github.getOrgRepoList({ org })
  const groups = getGroupedRepos(repos)

  if (opt.listGroups) {
    groups.forEach((it) => {
      reporter.log(it.name)
    })
    return
  }

  groups.forEach((group) => {
    if (opt.group !== undefined && opt.group !== group.name) {
      return
    }

    group.items
      .filter((it) => opt.includeArchived || !it.isArchived)
      .filter((it) => opt.name === undefined || it.name.includes(opt.name))
      .filter((it) => opt.topic === undefined || includesTopic(it, opt.topic))
      .filter(
        (it) =>
          !opt.excludeExisting ||
          !fs.existsSync(path.resolve(config.cwd, it.name)),
      )
      .forEach((repo) => {
        // The output of this is used to pipe into e.g. bash.
        // We cannot use reporter.log as it adds additional characters.
        process.stdout.write(
          sprintf('[ ! -e "%s" ] && git clone %s\n', repo.name, repo.sshUrl),
        )
      })
  })
}

const command: CommandModule = {
  command: "generate-clone-commands",
  describe: "Generate shell commands to clone GitHub repos for an organization",
  builder: (yargs) =>
    yargs
      .positional("group", {
        describe: "Group to generate commands for",
      })
      .options("org", {
        demandOption: true,
        describe: "Specify GitHub organization",
        type: "string",
      })
      .option("all", {
        describe: "Use all groups",
        type: "boolean",
      })
      .option("list-groups", {
        alias: "l",
        describe: "List available groups",
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
      })
      .option("topic", {
        alias: "t",
        describe: "Filter by specific topic",
        type: "string",
      })
      .option("exclude-existing", {
        alias: "x",
        describe: "Exclude if existing in working directory",
        type: "boolean",
      }),
  handler: async (argv) => {
    const config = createConfig()

    return generateCloneCommands({
      reporter: createReporter(argv),
      config,
      github: await createGitHubService({
        config,
        cache: createCacheProvider(config, argv),
      }),
      all: !!argv.all,
      listGroups: !!argv["list-groups"],
      includeArchived: !!argv["include-archived"],
      name: argv.name as string | undefined,
      topic: argv.topic as string | undefined,
      excludeExisting: !!argv["exclude-existing"],
      group: argv.group as string | undefined,
      org: argv["org"] as string,
    })
  },
}

export default command
