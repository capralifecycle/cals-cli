import chalk from "chalk";
import readline from "readline";
const CLEAR_WHOLE_LINE = 0;
function clearLine(stdout) {
    readline.clearLine(stdout, CLEAR_WHOLE_LINE);
    readline.cursorTo(stdout, 0);
}
export class Reporter {
    constructor(opts = {}) {
        this.nonInteractive = !!opts.nonInteractive;
        this.isVerbose = !!opts.verbose;
    }
    stdout = process.stdout;
    stderr = process.stderr;
    stdin = process.stdin;
    isTTY = this.stdout.isTTY;
    nonInteractive;
    isVerbose;
    format = chalk;
    startTime = Date.now();
    error(msg) {
        clearLine(this.stderr);
        this.stderr.write(`${this.format.red("error")} ${msg}\n`);
    }
    log(msg) {
        clearLine(this.stdout);
        this.stdout.write(`${msg}\n`);
    }
    warn(msg) {
        clearLine(this.stderr);
        this.stderr.write(`${this.format.yellow("warning")} ${msg}\n`);
    }
    success(msg) {
        clearLine(this.stdout);
        this.stdout.write(`${this.format.green("success")} ${msg}\n`);
    }
    info(msg) {
        clearLine(this.stdout);
        this.stdout.write(`${this.format.blue("info")} ${msg}\n`);
    }
}
