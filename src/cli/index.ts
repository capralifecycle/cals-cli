import yargs from 'yargs'
import gettingStarted from './commands/getting-started'
import github from './commands/github'

const gitCommit =
  (global as any).__GIT_COMMIT__ === undefined
    ? 'development'
    : (global as any).__GIT_COMMIT__.substring(0, 8)
const buildTime =
  (global as any).__BUILD_TIME__ === undefined
    ? new Date()
    : new Date((global as any).__BUILD_TIME__)

async function main(): Promise<void> {
  // http://patorjk.com/software/taag/#p=display&f=Slant&t=CALS
  const header = `
      _________    __   _____
     / ____/   |  / /  / ___/
    / /   / /| | / /   \\__ \\
   / /___/ ___ |/ /______/ /
   \\____/_/  |_/_____/____/
     cli

Built ${buildTime}
https://github.com/capralifecycle/cals-cli/commit/${gitCommit}

Usage: cals <command>`

  yargs
    .usage(header)
    .scriptName('cals')
    .locale('en')
    .version(`${gitCommit}-${buildTime}`)
    .help('help')
    .command(github)
    .command(gettingStarted)
    .demandCommand()
    .option('non-interactive', {
      describe: 'Non-interactive mode',
      type: 'boolean'
    })
    .option('verbose', {
      describe: 'Verbose output',
      type: 'boolean'
    })
    .parse()
}

main().catch(error => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

// Definer prosjekt-navn
// Definer ønskede miljøer
// Baselines som skal brukse
// Er bruker logget inn?
// Lag repo og endre commit
// Osv. osv. osv.
