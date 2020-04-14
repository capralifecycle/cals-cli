import { CommandModule } from "yargs"
import { createReporter } from "../../cli/util"

const command: CommandModule = {
  command: "getting-started",
  describe: "Getting started",
  handler: (argv) => {
    const reporter = createReporter(argv)
    reporter.log(
      "For getting started, see https://confluence.capraconsulting.no/x/cgGzBg",
    )
  },
}

export default command
