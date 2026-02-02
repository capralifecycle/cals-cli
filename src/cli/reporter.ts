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
  process.stdout.write(options.prompt)

  // For silent mode, read character by character with raw mode to hide input
  if (options.silent && process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let input = ""
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.setEncoding("utf8")

      const timer = options.timeout
        ? setTimeout(() => {
            cleanup()
            reject(new Error("Input timed out"))
          }, options.timeout)
        : null

      const cleanup = () => {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener("data", onData)
        if (timer) clearTimeout(timer)
      }

      const onData = (char: string) => {
        if (char === "\r" || char === "\n") {
          cleanup()
          process.stdout.write("\n")
          resolve(input)
        } else if (char === "\u0003") {
          // Ctrl+C
          cleanup()
          process.exit(1)
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          input = input.slice(0, -1)
        } else {
          input += char
        }
      }

      process.stdin.on("data", onData)
    })
  }

  // Normal (non-silent) mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve, reject) => {
    const timer = options.timeout
      ? setTimeout(() => {
          rl.close()
          reject(new Error("Input timed out"))
        }, options.timeout)
      : null

    rl.question("", (answer) => {
      if (timer) clearTimeout(timer)
      rl.close()
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

  /**
   * Write a status message to stderr for feedback during long-running operations.
   * Writing to stderr ensures it doesn't interfere with piped stdout.
   */
  public status(msg: string): void {
    this.stderr.write(`${this.format.dim(msg)}\n`)
  }
}
