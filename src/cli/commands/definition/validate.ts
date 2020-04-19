import { CommandModule } from "yargs"
import {
  createReporter,
  definitionFileOptionName,
  definitionFileOptionValue,
  getDefinitionFile,
} from "../../util"

const command: CommandModule = {
  command: "validate",
  describe: "Validate definition file.",
  builder: (yargs) =>
    yargs.option(definitionFileOptionName, definitionFileOptionValue),
  handler: async (argv) => {
    const reporter = createReporter(argv)

    await getDefinitionFile(argv).getDefinition()

    reporter.info("Valid!")
  },
}

export default command
