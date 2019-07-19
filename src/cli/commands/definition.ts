import yargs, { CommandModule } from 'yargs'
import dumpSetup from './definition/dump-setup'
import validate from './definition/validate'

const command: CommandModule = {
  command: 'definition',
  describe: 'CALS definition file management',
  builder: yargs =>
    yargs
      .command(dumpSetup)
      .command(validate)
      .demandCommand().usage(`cals definition

The definition file is located at
https://github.com/capralifecycle/resources-definition/blob/master/resources.yaml

The file ~/.cals-config.json must include a reference to the location of this
file. For example by having this content:

  {
    "definitionFile": "/home/henrste/projects/capralifecycle/resources-definition/resources.yaml"
  }

Also remember to fetch the resources-definition repository every time you use cals-cli.`),
  handler: () => {
    yargs.showHelp()
  },
}

export default command
