import read from "read"
import { CommandModule } from "yargs"
import {
  createDetectifyService,
  DetectifyService,
} from "../../../detectify/service"
import { Reporter } from "../../reporter"
import { createConfig, createReporter } from "../../util"

async function setToken({
  reporter,
  detectify,
  token,
}: {
  reporter: Reporter
  detectify: DetectifyService
  token: string | undefined
}) {
  if (token === undefined) {
    reporter.info("Need API token to talk to Detectify")
    reporter.info("See API keys under https://detectify.com/dashboard/team")

    token = await new Promise<string>((resolve, reject) => {
      read(
        {
          prompt: "Enter new Detectify API token: ",
          silent: true,
        },
        (err, answer) => {
          if (err) {
            reject(err)
          }
          resolve(answer)
        },
      )
    })
  }

  await detectify.setToken(token)
  reporter.info("Token saved")
}

const command: CommandModule = {
  command: "set-token",
  describe: "Set Detectify token for API calls",
  builder: (yargs) =>
    yargs.positional("token", {
      describe: "Token. If not provided it will be requested as input",
    }),
  handler: async (argv) =>
    setToken({
      reporter: createReporter(argv),
      detectify: createDetectifyService(createConfig()),
      token: argv.token as string | undefined,
    }),
}

export default command
