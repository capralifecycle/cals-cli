import fetch from "node-fetch"
import { Config } from "../config"
import { Definition } from "../definition/types"
import { SnykTokenCliProvider, SnykTokenProvider } from "./token"
import { SnykProject } from "./types"

interface SnykServiceProps {
  config: Config
  tokenProvider: SnykTokenProvider
}

export class SnykService {
  private config: Config
  private tokenProvider: SnykTokenProvider

  public constructor(props: SnykServiceProps) {
    this.config = props.config
    this.tokenProvider = props.tokenProvider
  }

  public async getProjects(definition: Definition): Promise<SnykProject[]> {
    const snykAccountId = definition.snyk?.accountId
    if (snykAccountId === undefined) {
      return []
    }

    return this.getProjectsByAccountId(snykAccountId)
  }

  public async getProjectsByAccountId(
    snykAccountId: string,
  ): Promise<SnykProject[]> {
    const token = await this.tokenProvider.getToken()
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
      await this.tokenProvider.markInvalid()
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

interface CreateSnykServiceProps {
  config: Config
  tokenProvider?: SnykTokenProvider
}

export function createSnykService(props: CreateSnykServiceProps): SnykService {
  return new SnykService({
    config: props.config,
    tokenProvider: props.tokenProvider ?? new SnykTokenCliProvider(),
  })
}
