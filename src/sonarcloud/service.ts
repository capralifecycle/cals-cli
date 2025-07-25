import { Buffer } from "node:buffer"
import process from "node:process"
import fetch from "node-fetch"
import type { Config } from "../config"
import {
  SonarCloudTokenCliProvider,
  type SonarCloudTokenProvider,
} from "./token"

interface SonarCloudServiceProps {
  config: Config
  tokenProvider: SonarCloudTokenProvider
}

export class SonarCloudService {
  private config: Config
  private tokenProvider: SonarCloudTokenProvider

  public constructor(props: SonarCloudServiceProps) {
    this.config = props.config
    this.tokenProvider = props.tokenProvider
  }

  /**
   * Returns metrics for project with given key.
   * ONLY test coverage metrics are returned as of now
   */
  public async getMetricsByProjectKey(sonarCloudProjectKey: string) {
    const token = await this.tokenProvider.getToken()
    if (token === undefined) {
      throw new Error("Missing token for SonarCloud")
    }

    const response = await fetch(
      `https://sonarcloud.io/api/measures/component?component=${encodeURIComponent(
        sonarCloudProjectKey,
      )}&metricKeys=coverage`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            token.concat(":"),
            "utf8",
          ).toString("base64")}`,
        },
        agent: this.config.agent,
      },
    )

    if (response.status === 401) {
      process.stderr.write("Unauthorized - removing token\n")
      await this.tokenProvider.markInvalid()
    }

    if (response.status === 404) {
      process.stderr.write(
        `Project ${sonarCloudProjectKey} does not exist in SonarCloud\n`,
      )
      return undefined
    }

    if (!response.ok) {
      throw new Error(
        `Response from SonarCloud not OK (${
          response.status
        }): ${await response.text()}`,
      )
    }

    return (await response.json()) as {
      component: {
        id: string
        key: string
        name: string
        qualifier: string
        measures: {
          metric: string
          value: string
        }[]
      }
    }
  }
}

interface CreateSonarCloudServiceProps {
  config: Config
  tokenProvider?: SonarCloudTokenProvider
}

export function createSonarCloudService(
  props: CreateSonarCloudServiceProps,
): SonarCloudService {
  return new SonarCloudService({
    config: props.config,
    tokenProvider: props.tokenProvider ?? new SonarCloudTokenCliProvider(),
  })
}
