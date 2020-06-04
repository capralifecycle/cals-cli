import keytar from "keytar"
import fetch from "node-fetch"
import { Config } from "../config"
import { Definition } from "../definition/types"
import { SnykProject } from "./types"

const keyringService = "cals"
const keyringAccount = "snyk-token"

export class SnykService {
  public constructor(config: Config) {
    this.config = config
  }

  private config: Config

  private async removeToken() {
    await keytar.deletePassword(keyringService, keyringAccount)
  }

  public async setToken(value: string): Promise<void> {
    await keytar.setPassword(keyringService, keyringAccount, value)
  }

  public static async getToken(): Promise<string | undefined> {
    if (process.env.CALS_SNYK_TOKEN) {
      return process.env.CALS_SNYK_TOKEN
    }

    const result = await keytar.getPassword(keyringService, keyringAccount)
    if (result == null) {
      process.stderr.write(
        "No token found. Register using `cals snyk set-token`\n",
      )
      return undefined
    }

    return result
  }

  public async getProjects(definition: Definition): Promise<SnykProject[]> {
    const snykAccountId = definition.snyk?.accountId
    if (snykAccountId === undefined) {
      return []
    }

    const token = await SnykService.getToken()
    if (token === undefined) {
      throw new Error("Missing token for Snyk")
    }

    const response = await fetch(
      `https://snyk.io/api/v1/org/${encodeURIComponent(
        snykAccountId,
      )}/projects`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `token ${token}`,
        },
        agent: this.config.agent,
      },
    )

    if (response.status === 401) {
      process.stderr.write("Unauthorized - removing token\n")
      await this.removeToken()
    }

    if (!response.ok) {
      throw new Error(
        `Response from Snyk not OK (${response.status}): ${JSON.stringify(
          response,
        )}`,
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (await response.json()).projects as SnykProject[]
  }
}

export function createSnykService(config: Config): SnykService {
  return new SnykService(config)
}
