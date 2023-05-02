import read from "read";
import { DetectifyTokenCliProvider } from "../../../detectify/token";
import { createReporter } from "../../util";
async function setToken({ reporter, token, tokenProvider, }) {
    if (token === undefined) {
        reporter.info("Need API token to talk to Detectify");
        reporter.info("See API keys under https://detectify.com/dashboard/team");
        token = await new Promise((resolve, reject) => {
            read({
                prompt: "Enter new Detectify API token: ",
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
    describe: "Set Detectify token for API calls",
    builder: (yargs) => yargs.positional("token", {
        describe: "Token. If not provided it will be requested as input",
    }),
    handler: async (argv) => {
        return setToken({
            reporter: createReporter(argv),
            token: argv.token,
            tokenProvider: new DetectifyTokenCliProvider(),
        });
    },
};
export default command;
