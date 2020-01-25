import fs from "fs"
import path from "path"
import { Config } from "./config"

interface CacheItem<T> {
  cacheTime: number // getTime()
  data: T
}

export class CacheProvider {
  public constructor(config: Config) {
    this.config = config
  }

  public enabled = true
  private config: Config
  private defaultCacheTime = 1800

  /**
   * Retrieve cache if existent, ignoring the time.
   */
  public retrieveJson<T>(cachekey: string): CacheItem<T> | undefined {
    const cachefile = path.join(this.config.cacheDir, `${cachekey}.json`)

    if (!fs.existsSync(cachefile)) {
      return undefined
    }

    return {
      cacheTime: fs.statSync(cachefile).mtime.getTime(),
      data: JSON.parse(fs.readFileSync(cachefile, "utf-8")) as T,
    }
  }

  /**
   * Save data to cache.
   */
  public storeJson<T>(cachekey: string, data: T) {
    const cachefile = path.join(this.config.cacheDir, `${cachekey}.json`)

    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true })
    }

    fs.writeFileSync(cachefile, JSON.stringify(data))
  }

  public async json<T>(
    cachekey: string,
    block: () => Promise<T>,
    cachetime: number = this.defaultCacheTime,
  ) {
    if (!this.enabled) {
      return await block()
    }

    const cacheItem = this.retrieveJson<T>(cachekey)
    const expire = new Date(new Date().getTime() - cachetime * 1000).getTime()

    if (cacheItem !== undefined && cacheItem.cacheTime > expire) {
      return cacheItem.data
    }

    const result = await block()

    this.storeJson<T>(cachekey, result)
    return result
  }
}
