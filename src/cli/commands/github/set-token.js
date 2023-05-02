import read from "read";
import { GitHubTokenCliProvider } from "../../../github/token";
import { createReporter } from "../../util";
async function setToken({ reporter, token, tokenProvider, }) {
    if (token === undefined) {
        reporter.info("Need API token to talk to GitHub");
        reporter.info("https://github.com/settings/tokens/new?scopes=repo:status,read:repo_hook");
        token = await new Promise((resolve, reject) => {
            read({
                prompt: "Enter new GitHub API token: ",
                silent: true,
            }, (err, answer) => {
                if (err) {
                    reject(err);
                }
                resolve(answer);
            });
        });
    }
    await tokenProvider.setToken(token);
    reporter.info("Token saved");
}
const command = {
    command: "set-token",
    describe: "Set GitHub token for API calls",
    builder: (yargs) => yargs.positional("token", {
        describe: "Token. If not provided it will be requested as input. Can be generated at https://github.com/settings/tokens/new?scopes=repo:status,read:repo_hook",
    }),
    handler: async (argv) => {
        await setToken({
            reporter: createReporter(argv),
            token: argv.token,
            tokenProvider: new GitHubTokenCliProvider(),
        });
    },
};
export default command;
