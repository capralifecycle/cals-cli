import fs from 'fs'
import path from 'path'
import { Config } from './config'

export class CacheProvider {
  public constructor(config: Config) {
    this.config = config
  }

  public enabled = true
  private config: Config
  private defaultCacheTime = 1800

  public async json<T>(
    cachekey: string,
    block: () => Promise<T>,
    cachetime: number = this.defaultCacheTime,
  ) {
    if (!this.enabled) {
      return await block()
    }

    const cachefile = path.join(this.config.cacheDir, `${cachekey}.json`)
    const expire = new Date(new Date().getTime() - cachetime * 1000)

    if (fs.existsSync(cachefile) && fs.statSync(cachefile).mtime > expire) {
      return JSON.parse(fs.readFileSync(cachefile, 'utf-8')) as T
    }

    const result = await block()

    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true })
    }

    fs.writeFileSync(cachefile, JSON.stringify(result))
    return result
  }
}
