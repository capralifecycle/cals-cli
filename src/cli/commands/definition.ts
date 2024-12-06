import yargs, { CommandModule } from "yargs"
import dumpSetup from "./definition/dump-setup"
import validate from "./definition/validate"
import { hideBin } from "yargs/helpers"

const command: CommandModule = {
  command: "definition",
  describe: "CALS definition file management",
  builder: (yargs) =>
    yargs
      .command(dumpSetup)
      .command(validate)
      .demandCommand()
      .usage(`cals definition`),
  handler: () => {
    yargs(hideBin(process.argv)).showHelp()
  },
}

export default command
