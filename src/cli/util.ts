import readline from 'readline'
import yargs from 'yargs'
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

export function createConfig() {
  return new Config()
}
