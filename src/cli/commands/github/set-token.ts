import { read } from "read"
import { CommandModule } from "yargs"
import { GitHubTokenCliProvider } from "../../../github/token"
import { Reporter } from "../../reporter"
import { createReporter } from "../../util"

async function setToken({
  reporter,
  token,
  tokenProvider,
}: {
  reporter: Reporter
  token: string | undefined
  tokenProvider: GitHubTokenCliProvider
}) {
  if (token === undefined) {
    reporter.info("Need API token to talk to GitHub")
    reporter.info(
      "https://github.com/settings/tokens/new?scopes=repo:status,read:repo_hook",
    )
    const inputToken = await read({
      prompt: "Enter new GitHub API token: ",
      silent: true,
    })
    token = inputToken
  }

  await tokenProvider.setToken(token)
  reporter.info("Token saved")
}

const command: CommandModule = {
  command: "set-token",
  describe: "Set GitHub token for API calls",
  builder: (yargs) =>
    yargs.positional("token", {
      describe:
        "Token. If not provided it will be requested as input. Can be generated at https://github.com/settings/tokens/new?scopes=repo:status,read:repo_hook",
    }),
  handler: async (argv) => {
    await setToken({
      reporter: createReporter(argv),
      token: argv.token as string | undefined,
      tokenProvider: new GitHubTokenCliProvider(),
    })
  },
}

export default command
