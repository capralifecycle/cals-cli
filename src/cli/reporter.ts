import process from "node:process"
import readline from "node:readline"
import chalk from "chalk"

const CLEAR_WHOLE_LINE = 0

function clearLine(stdout: NodeJS.WriteStream) {
  readline.clearLine(stdout, CLEAR_WHOLE_LINE)
  readline.cursorTo(stdout, 0)
}

export async function readInput(options: {
  prompt: string
  silent?: boolean
  timeout?: number
}): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  if (options.silent) {
    // Mute output for password entry
    ;(rl as any)._writeToOutput = () => {}
  }

  return new Promise((resolve, reject) => {
    const timer = options.timeout
      ? setTimeout(() => {
          rl.close()
          reject(new Error("Input timed out"))
        }, options.timeout)
      : null

    rl.question(options.prompt, (answer) => {
      if (timer) clearTimeout(timer)
      rl.close()
      if (options.silent) {
        process.stdout.write("\n")
      }
      resolve(answer)
    })
  })
}

export class Reporter {
  public stdout = process.stdout
  public stderr = process.stderr
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
