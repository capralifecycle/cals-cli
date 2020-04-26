import yargs, { CommandModule } from "yargs"
import analyzeDirectory from "./github/analyze-directory"
import configure from "./github/configure"
import generateCloneCommands from "./github/generate-clone-commands"
import listPullRequestsStats from "./github/list-pull-requests-stats"
import listRepos from "./github/list-repos"
import listWebhooks from "./github/list-webhooks"
import setToken from "./github/set-token"
import sync from "./github/sync"

const command: CommandModule = {
  command: "github",
  describe: "Integration with GitHub",
  builder: (yargs) =>
    yargs
      .command(analyzeDirectory)
      .command(configure)
      .command(generateCloneCommands)
      .command(listPullRequestsStats)
      .command(listRepos)
      .command(listWebhooks)
      .command(setToken)
      .command(sync)
      .demandCommand().usage(`cals github

Notes:
  Before doing anything against GitHub you need to configure a token
  used for authentication. The following command will ask for a token
  and provide a link to generate one:
  $ cals github set-token

  Quick clone all repos:
  $ cals github generate-clone-commands --org capralifecycle --all -x | bash

  And for a specific project:
  $ cals github generate-clone-commands --org capralifecycle -x buildtools | bash

  Keeping up to date with removed/renamed repos:
  $ cals github analyze-directory --org capralifecycle

  Some responses are cached for some time. Use the --validate-cache
  option to avoid stale cache. The cache can also be cleared with
  the "cals delete-cache" command.`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
