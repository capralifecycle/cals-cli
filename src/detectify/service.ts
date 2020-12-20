import fetch from "node-fetch"
import { Config } from "../config"
import { DetectifyTokenCliProvider, DetectifyTokenProvider } from "./token"
import { DetectifyScanProfile, DetectifyScanReport } from "./types"

type ApiResponse<T> = { ok: T } | { error: "not-found" }

function requireOk<T>(response: ApiResponse<T>) {
  if (!("ok" in response)) {
    throw new Error(`Response: ${response.error}`)
  }
  return response.ok
}

interface DetectifyServiceProps {
  config: Config
  tokenProvider: DetectifyTokenProvider
}

export class DetectifyService {
  private config: Config
  private tokenProvider: DetectifyTokenProvider

  public constructor(props: DetectifyServiceProps) {
    this.config = props.config
    this.tokenProvider = props.tokenProvider
  }

  private async getRequest<T>(url: string): Promise<ApiResponse<T>> {
    const token = await this.tokenProvider.getToken()
    if (token === undefined) {
      throw new Error("Missing token for Detectify")
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Detectify-Key": `${token}`,
      },
      agent: this.config.agent,
    })

    if (response.status === 401) {
      process.stderr.write("Unauthorized - removing token\n")
      await this.tokenProvider.markInvalid()
    }

    if (response.status === 404) {
      return {
        error: "not-found",
      }
    }

    if (!response.ok) {
      throw new Error(
        `Response from Detectify not OK (${response.status}): ${JSON.stringify(
          response,
        )}`,
      )
    }

    return {
      ok: (await response.json()) as T,
    }
  }

  public async getScanProfiles(): Promise<DetectifyScanProfile[]> {
    return requireOk(
      await this.getRequest<DetectifyScanProfile[]>(
        "https://api.detectify.com/rest/v2/profiles/",
      ),
    )
  }

  public async getScanReportLatest(
    scanProfileToken: string,
  ): Promise<DetectifyScanReport | null> {
    const response = await this.getRequest<DetectifyScanReport>(
      `https://api.detectify.com/rest/v2/reports/${encodeURIComponent(
        scanProfileToken,
      )}/latest/`,
    )

    if ("ok" in response) {
      return response.ok
    } else if (response.error === "not-found") {
      return null
    } else {
      throw new Error(`Unknown response: ${JSON.stringify(response)}`)
    }
  }
}

interface CreateDetectifyServiceProps {
  config: Config
  tokenProvider?: DetectifyTokenProvider
}

export function createDetectifyService(
  props: CreateDetectifyServiceProps,
): DetectifyService {
  return new DetectifyService({
    config: props.config,
    tokenProvider: props.tokenProvider ?? new DetectifyTokenCliProvider(),
  })
}
