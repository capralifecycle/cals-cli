import yargs, { CommandModule } from "yargs"
import dumpSetup from "./definition/dump-setup"
import validate from "./definition/validate"

const command: CommandModule = {
  command: "definition",
  describe: "CALS definition file management",
  builder: (yargs) =>
    yargs.command(dumpSetup).command(validate).demandCommand()
      .usage(`cals definition

The definition file is located at
https://github.com/capralifecycle/resources-definition/blob/master/resources.yaml

The file ~/.cals-config.json must include a reference to the location of this
file. See README for details: https://github.com/capralifecycle/cals-cli`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
