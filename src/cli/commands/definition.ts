import process from "node:process"
import yargs, { type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import dumpSetup from "./definition/dump-setup"
import validate from "./definition/validate"

const command: CommandModule = {
  command: "definition",
  describe: "CALS definition file management",
  builder: (yargs) =>
    yargs
      .command(dumpSetup)
      .command(validate)
      .demandCommand()
      .usage("cals definition"),
  handler: () => {
    yargs(hideBin(process.argv)).showHelp()
  },
}

export default command
