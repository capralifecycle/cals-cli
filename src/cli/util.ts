import { Arguments } from 'yargs'
import { CacheProvider } from '../cache'
import { Config } from '../config'
import { Reporter } from './reporter'

export function createReporter(argv: Arguments) {
  return new Reporter({
    verbose: !!argv.verbose,
    nonInteractive: !!argv.nonInteractive,
  })
}

export function createCacheProvider(config: Config, argv: Arguments) {
  const cache = new CacheProvider(config)

  // --no-cache
  if (argv.cache === false) {
    cache.enabled = false
  }
  return cache
}

export function createConfig() {
  return new Config()
}
