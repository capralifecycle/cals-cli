import type { CommandModule } from "yargs"
import { GitHubTokenCliProvider } from "../../github/token"
import { type Reporter, readInput } from "../reporter"
import { createReporter } from "../util"

async function authenticate({
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
    const inputToken = await readInput({
      prompt: "Enter GitHub token: ",
      silent: true,
    })
    token = inputToken
  }

  await tokenProvider.setToken(token)
  reporter.info("Token saved to keychain")
}

const command: CommandModule = {
  command: "auth [token]",
  describe: "Authenticate with GitHub",
  builder: (yargs) =>
    yargs.positional("token", {
      describe: "GitHub token (prompted if not provided)",
      type: "string",
    }),
  handler: async (argv) => {
    await authenticate({
      reporter: createReporter(),
      token: argv.token as string | undefined,
      tokenProvider: new GitHubTokenCliProvider(),
    })
  },
}

export default command
