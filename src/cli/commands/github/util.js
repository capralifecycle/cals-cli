export async function reportRateLimit(reporter, github, block) {
    reporter.info(`Rate limit: ${(await github.octokit.rateLimit.get()).data.rate.remaining}`);
    await block();
    reporter.info(`Rate limit: ${(await github.octokit.rateLimit.get()).data.rate.remaining}`);
}
