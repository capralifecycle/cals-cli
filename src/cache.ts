import fs from 'fs'
import path from 'path'
import { Config } from './config'

export async function provideCacheJson<T>(
  config: Config,
  cachekey: string,
  block: () => Promise<T>,
  cachetime: number = 1800,
) {
  const cachefile = path.join(config.cacheDir, `${cachekey}.json`)
  const expire = new Date(new Date().getTime() - cachetime * 1000)

  if (fs.existsSync(cachefile) && fs.statSync(cachefile).mtime > expire) {
    return JSON.parse(fs.readFileSync(cachefile, 'utf-8')) as T
  }

  const result = await block()

  if (!fs.existsSync(config.cacheDir)) {
    fs.mkdirSync(config.cacheDir, { recursive: true })
  }

  fs.writeFileSync(cachefile, JSON.stringify(result))
  return result
}
