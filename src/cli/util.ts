import { deprecate } from "util"
import { Arguments } from "yargs"
import { CacheProvider } from "../cache"
import { Config } from "../config"
import { Reporter } from "./reporter"

export function createReporter(argv: Arguments) {
  return new Reporter({
    verbose: !!argv.verbose,
    nonInteractive: !!argv.nonInteractive,
  })
}

export function createCacheProvider(config: Config, argv: Arguments) {
  const cache = new CacheProvider(config)

  // --validate-cache
  if (argv.validateCache === true) {
    cache.mustValidate = true
  }

  // old option: --no-cache
  if (argv.cache === false) {
    deprecate(() => {
      cache.mustValidate = true
    }, "The --no-cache option is deprecated. See new --validate-cache option")()
  }

  return cache
}

export function createConfig() {
  return new Config()
}
