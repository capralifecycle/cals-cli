import yargs from "yargs";
import dumpSetup from "./definition/dump-setup";
import validate from "./definition/validate";
const command = {
    command: "definition",
    describe: "CALS definition file management",
    builder: (yargs) => yargs
        .command(dumpSetup)
        .command(validate)
        .demandCommand()
        .usage(`cals definition`),
    handler: () => {
        yargs.showHelp();
    },
};
export default command;
