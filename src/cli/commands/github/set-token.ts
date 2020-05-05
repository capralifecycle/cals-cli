import read from "read"
import { CommandModule } from "yargs"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

async function setToken({
  reporter,
  github,
  token,
}: {
  reporter: Reporter
  github: GitHubService
  token: string | undefined
}) {
  if (token === undefined) {
    reporter.info("Need API token to talk to GitHub")
    reporter.info(
      "https://github.com/settings/tokens/new?scopes=repo:status,read:repo_hook",
    )

    token = await new Promise<string>((resolve, reject) => {
      read(
        {
          prompt: "Enter new GitHub API token: ",
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

  await github.setToken(token)
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
    const config = createConfig()
    await setToken({
      reporter: createReporter(argv),
      github: await createGitHubService(
        config,
        createCacheProvider(config, argv),
      ),
      token: argv.token as string | undefined,
    })
  },
}

export default command
