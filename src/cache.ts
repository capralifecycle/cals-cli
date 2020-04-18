import fs from "fs"
import path from "path"
import rimraf from "rimraf"
import { Config } from "./config"

interface CacheItem<T> {
  cacheTime: ReturnType<Date["getTime"]>
  data: T
}

export class CacheProvider {
  public constructor(config: Config) {
    this.config = config
  }

  public mustValidate = false
  private config: Config
  private defaultCacheTime = 1800

  /**
   * Retrieve cache if existent, ignoring the time.
   *
   * The caller is responsible for handling proper validation,
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
    const cacheItem = this.mustValidate
      ? undefined
      : this.retrieveJson<T>(cachekey)
    const expire = new Date(new Date().getTime() - cachetime * 1000).getTime()

    if (cacheItem !== undefined && cacheItem.cacheTime > expire) {
      return cacheItem.data
    }

    const result = await block()

    this.storeJson<T>(cachekey, result)
    return result
  }

  /**
   * Delete all cached data.
   */
  public cleanup(): void {
    rimraf.sync(this.config.cacheDir)
  }
}
