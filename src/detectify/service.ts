import keytar from 'keytar'
import fetch from 'node-fetch'
import { Config } from '../config'
import { DetectifyScanProfile, DetectifyScanReport } from './types'

const keyringService = 'cals'
const keyringAccount = 'detectify-token'

type ApiResponse<T> = { ok: T } | { error: 'not-found' }

function requireOk<T>(response: ApiResponse<T>) {
  if (!('ok' in response)) {
    throw new Error(`Response: ${response.error}`)
  }
  return response.ok
}

export class DetectifyService {
  public constructor(config: Config) {
    this.config = config
  }

  private config: Config

  private async removeToken() {
    await keytar.deletePassword(keyringService, keyringAccount)
  }

  public async setToken(value: string) {
    await keytar.setPassword(keyringService, keyringAccount, value)
  }

  public static async getToken(): Promise<string | undefined> {
    if (process.env.CALS_DETECTIFY_TOKEN) {
      return process.env.CALS_DETECTIFY_TOKEN
    }

    const result = await keytar.getPassword(keyringService, keyringAccount)
    if (result == null) {
      process.stderr.write(
        'No token found. Register using `cals detectify set-token`\n',
      )
      return undefined
    }

    return result
  }

  private async getRequest<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Detectify-Key': `${await DetectifyService.getToken()}`,
      },
      agent: this.config.agent,
    })

    if (response.status === 401) {
      process.stderr.write('Unauthorized - removing token\n')
      await this.removeToken()
    }

    if (response.status === 404) {
      return {
        error: 'not-found',
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
        'https://api.detectify.com/rest/v2/profiles/',
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

    if ('ok' in response) {
      return response.ok
    } else if (response.error === 'not-found') {
      return null
    } else {
      throw new Error(`Unknown response: ${response}`)
    }
  }
}

export async function createDetectifyService(config: Config) {
  return new DetectifyService(config)
}
