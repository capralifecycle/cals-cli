import cachedir from "cachedir"
import fs from "fs"
import https from "https"
import os from "os"
import path from "path"

export class Config {
  public cwd = path.resolve(process.cwd())
  public configFile = path.join(os.homedir(), ".cals-config.json")
  public cacheDir = cachedir("cals-cli")
  public agent = new https.Agent({
    keepAlive: true,
  })

  private configCached?: Record<string, string> = undefined
  private get config() {
    const existingConfig = this.configCached
    if (existingConfig !== undefined) {
      return existingConfig
    }

    const config = this.readConfig()
    this.configCached = config
    return config
  }
  private readConfig(): Record<string, string> {
    if (!fs.existsSync(this.configFile)) {
      return {}
    }

    try {
      return JSON.parse(fs.readFileSync(this.configFile, "utf-8"))
    } catch (e) {
      console.error("Failed", e)
      throw new Error("Failed to read config")
    }
  }

  public getConfig(key: string): string | undefined {
    return this.config[key]
  }

  public requireConfig(key: string): string {
    const result = this.config[key]
    if (result === undefined) {
      throw Error(
        `Configuration for ${key} missing. Add manually to ${this.configFile}`,
      )
    }
    return result
  }

  public updateConfig(key: string, value?: string) {
    const updatedConfig = {
      ...this.readConfig(),
      [key]: value, // undefined will remove
    }

    fs.writeFileSync(this.configFile, JSON.stringify(updatedConfig, null, "  "))
    this.configCached = updatedConfig as Record<string, string>
  }
}
