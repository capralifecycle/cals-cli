import yargs from 'yargs'
import gettingStarted from './commands/getting-started'
import definition from './commands/definition'
import github from './commands/github'
import snyk from './commands/snyk'

export async function main(): Promise<void> {
  // http://patorjk.com/software/taag/#p=display&f=Slant&t=CALS
  const header = `
      _________    __   _____
     / ____/   |  / /  / ___/
    / /   / /| | / /   \\__ \\
   / /___/ ___ |/ /______/ /
   \\____/_/  |_/_____/____/
     cli

https://github.com/capralifecycle/cals-cli/

Usage: cals <command>`

  yargs
    .usage(header)
    .scriptName('cals')
    .locale('en')
    .help('help')
    .command(definition)
    .command(github)
    .command(gettingStarted)
    .command(snyk)
    .demandCommand()
    .option('non-interactive', {
      describe: 'Non-interactive mode',
      type: 'boolean',
    })
    .option('verbose', {
      describe: 'Verbose output',
      type: 'boolean',
    })
    .parse()
}

// Definer prosjekt-navn
// Definer ønskede miljøer
// Baselines som skal brukse
// Er bruker logget inn?
// Lag repo og endre commit
// Osv. osv. osv.
