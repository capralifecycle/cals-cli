import process from "node:process"
export interface SonarCloudTokenProvider {
  getToken(): Promise<string | undefined>
  markInvalid(): Promise<void>
}
export class SonarCloudTokenCliProvider implements SonarCloudTokenProvider {
  async getToken(): Promise<string | undefined> {
    if (process.env.CALS_SONARCLOUD_TOKEN) {
      return Promise.resolve(process.env.CALS_SONARCLOUD_TOKEN)
    }

    process.stderr.write(
      "No environmental variable found. Set variable `CALS_SONARCLOUD_TOKEN` to token value\n",
    )
    return undefined
  }
  async markInvalid(): Promise<void> {
    await Promise.resolve()
  }
}
