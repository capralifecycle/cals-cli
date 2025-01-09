import chalk from "chalk"
import readline from "readline"

const CLEAR_WHOLE_LINE = 0

function clearLine(stdout: NodeJS.WriteStream) {
  readline.clearLine(stdout, CLEAR_WHOLE_LINE)
  readline.cursorTo(stdout, 0)
}

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
  public nonInteractive: boolean
  public isVerbose: boolean
  public format: typeof chalk = chalk

  public error(msg: string): void {
    clearLine(this.stderr)
    this.stderr.write(`${this.format.red("error")} ${msg}\n`)
  }

  public log(msg: string): void {
    clearLine(this.stdout)
    this.stdout.write(`${msg}\n`)
  }

  public warn(msg: string): void {
    clearLine(this.stderr)
    this.stderr.write(`${this.format.yellow("warning")} ${msg}\n`)
  }

  public info(msg: string): void {
    clearLine(this.stdout)
    this.stdout.write(`${this.format.blue("info")} ${msg}\n`)
  }
}
