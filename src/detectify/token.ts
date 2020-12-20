import keytar from "keytar"

export interface DetectifyTokenProvider {
  getToken(): Promise<string | undefined>
  markInvalid(): Promise<void>
}

export class DetectifyTokenCliProvider implements DetectifyTokenProvider {
  private keyringService = "cals"
  private keyringAccount = "detectify-token"

  async getToken(): Promise<string | undefined> {
    if (process.env.CALS_DETECTIFY_TOKEN) {
      return process.env.CALS_DETECTIFY_TOKEN
    }

    const result = await keytar.getPassword(
      this.keyringService,
      this.keyringAccount,
    )
    if (result == null) {
      process.stderr.write(
        "No token found. Register using `cals detectify set-token`\n",
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
