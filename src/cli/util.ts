import { CacheProvider } from "../cache"
import { Config } from "../config"
import { Reporter } from "./reporter"

export function createReporter(): Reporter {
  return new Reporter()
}

export function createCacheProvider(
  config: Config,
  argv: Record<string, unknown>,
): CacheProvider {
  const cache = new CacheProvider(config)

  if (argv.noCache === true) {
    cache.mustValidate = true
  }

  return cache
}

export function createConfig(): Config {
  return new Config()
}
