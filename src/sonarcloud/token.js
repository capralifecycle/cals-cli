export class SonarCloudTokenCliProvider {
    async getToken() {
        if (process.env.CALS_SONARCLOUD_TOKEN) {
            return Promise.resolve(process.env.CALS_SONARCLOUD_TOKEN);
        }
        process.stderr.write("No environmental variable found. Set variable `CALS_SONARCLOUD_TOKEN` to token value\n");
        return undefined;
    }
    async markInvalid() {
        await Promise.resolve();
    }
}
