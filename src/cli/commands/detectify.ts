import yargs, { CommandModule } from "yargs"
import report from "./detectify/report"
import setToken from "./detectify/set-token"

const command: CommandModule = {
  command: "detectify",
  describe: "Integration with Detectify",
  builder: yargs =>
    yargs
      .command(setToken)
      .command(report)
      .demandCommand().usage(`cals detectify

Notes:
  Before doing anything against Detectify you need to configure a token
  used for authentication. The following command will ask for a token
  and provide a link to generate one:
  $ cals detectify set-token`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
