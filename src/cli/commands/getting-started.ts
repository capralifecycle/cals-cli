import { CommandModule } from "yargs"
import { createReporter } from "../util"

const command: CommandModule = {
  command: "getting-started",
  describe: "Getting started",
  handler: (argv) => {
    const reporter = createReporter(argv)
    reporter.log(
      "For getting started, see https://liflig.atlassian.net/wiki/x/E8MNAQ",
    )
  },
}

export default command
