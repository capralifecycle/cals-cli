import keytar from "keytar"

export interface GitHubTokenProvider {
  getToken(): Promise<string | undefined>
  markInvalid(): Promise<void>
}

export class GitHubTokenCliProvider implements GitHubTokenProvider {
  private keyringService = "cals"
  private keyringAccount = "github-token"

  async getToken(): Promise<string | undefined> {
    if (process.env.CALS_GITHUB_TOKEN) {
      return process.env.CALS_GITHUB_TOKEN
    }

    const result = await keytar.getPassword(
      this.keyringService,
      this.keyringAccount,
    )
    if (result == null) {
      process.stderr.write(
        "No token found. Register using `cals github set-token`\n",
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
