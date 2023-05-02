import { sprintf } from "sprintf-js";
import { createDetectifyService, } from "../../../detectify/service";
import { createConfig, createReporter } from "../../util";
async function report({ reporter, detectify, }) {
    reporter.info("Listing Detectify profiles with latest report");
    const profiles = await detectify.getScanProfiles();
    for (const profile of profiles) {
        reporter.info("");
        reporter.info(sprintf("Project: %s", profile.name));
        reporter.info(sprintf("Endpoint: %s", profile.endpoint));
        const report = await detectify.getScanReportLatest(profile.token);
        if (report !== null) {
            reporter.info(sprintf("Score: %g", report.cvss));
        }
        else {
            reporter.warn("No report present");
        }
    }
}
const command = {
    command: "report",
    describe: "Report Detectify status",
    handler: async (argv) => report({
        reporter: createReporter(argv),
        detectify: createDetectifyService({ config: createConfig() }),
    }),
};
export default command;
