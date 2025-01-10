import keytar from "keytar"
import process from "node:process"

export interface SnykTokenProvider {
  getToken(): Promise<string | undefined>
  markInvalid(): Promise<void>
}

export class SnykTokenCliProvider implements SnykTokenProvider {
  private keyringService = "cals"
  private keyringAccount = "snyk-token"

  async getToken(): Promise<string | undefined> {
    if (process.env.CALS_SNYK_TOKEN) {
      return process.env.CALS_SNYK_TOKEN
    }

    const result = await keytar.getPassword(
      this.keyringService,
      this.keyringAccount,
    )
    if (result == null) {
      process.stderr.write(
        "No token found. Register using `cals snyk set-token`\n",
      )
      return undefined
    }

    return result
  }

  async markInvalid(): Promise<void> {
    await keytar.deletePassword(this.keyringService, this.keyringAccount)
  }

  public async setToken(value: string): Promise<void> {
    await keytar.setPassword(this.keyringService, this.keyringAccount, value)
  }
}
