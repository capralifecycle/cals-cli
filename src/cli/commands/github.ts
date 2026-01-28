import process from "node:process"
import yargs, { type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import generateCloneCommands from "./github/generate-clone-commands"
import listRepos from "./github/list-repos"
import setToken from "./github/set-token"
import sync from "./github/sync"

const command: CommandModule = {
  command: "github",
  describe: "Integration with GitHub",
  builder: (yargs) =>
    yargs
      .command(generateCloneCommands)
      .command(listRepos)
      .command(setToken)
      .command(sync)
      .demandCommand()
      .usage(`cals github

Notes:
  Before doing anything against GitHub you need to configure a token
  used for authentication. The following command will ask for a token
  and provide a link to generate one:
  $ cals github set-token

  Quick clone all repos:
  $ cals github generate-clone-commands --org capralifecycle --all -x | bash

  And for a specific project:
  $ cals github generate-clone-commands --org capralifecycle -x buildtools | bash

  Some responses are cached for some time. Use the --validate-cache
  option to avoid stale cache.`),
  handler: () => {
    yargs(hideBin(process.argv)).showHelp()
  },
}

export default command
