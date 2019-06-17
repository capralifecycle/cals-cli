import readline from 'readline'
import yargs from 'yargs'
import { CacheProvider } from '../cache'
import { Config } from '../config'
import { Reporter } from './reporter'

const CLEAR_WHOLE_LINE = 0

export function clearLine(stdout: NodeJS.WriteStream) {
  readline.clearLine(stdout, CLEAR_WHOLE_LINE)
  readline.cursorTo(stdout, 0)
}

export function createReporter() {
  return new Reporter({
    verbose: !!yargs.argv.verbose,
    nonInteractive: !!yargs.argv.nonInteractive,
  })
}

export function createCacheProvider(config: Config) {
  const cache = new CacheProvider(config)

  // --no-cache
  if (yargs.argv.cache === false) {
    cache.enabled = false
  }
  return cache
}

export function createConfig() {
  return new Config()
}
