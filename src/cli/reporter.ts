import chalk from 'chalk'
import { clearLine } from './util'

export class Reporter {
  public constructor(
    opts: {
      nonInteractive?: boolean
      verbose?: boolean
    } = {},
  ) {
    this.nonInteractive = !!opts.nonInteractive
    this.isVerbose = !!opts.verbose
  }

  public stdout = process.stdout
  public stderr = process.stderr
  public stdin = process.stdin
  public isTTY = this.stdout.isTTY
  public nonInteractive: boolean
  public isVerbose: boolean
  public format = chalk
  public startTime = Date.now()

  public error(msg: string) {
    clearLine(this.stderr)
    this.stderr.write(`${this.format.red('error')} ${msg}\n`)
  }

  public log(msg: string) {
    clearLine(this.stdout)
    this.stdout.write(`${msg}\n`)
  }

  public warn(msg: string) {
    clearLine(this.stderr)
    this.stderr.write(`${this.format.yellow('warning')} ${msg}\n`)
  }

  public success(msg: string) {
    clearLine(this.stdout)
    this.stdout.write(`${this.format.green('success')} ${msg}\n`)
  }

  public info(msg: string) {
    clearLine(this.stdout)
    this.stdout.write(`${this.format.blue('info')} ${msg}\n`)
  }
}
