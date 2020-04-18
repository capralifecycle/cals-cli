import { CommandModule } from "yargs"
import { createCacheProvider, createConfig, createReporter } from "../util"

const command: CommandModule = {
  command: "delete-cache",
  describe: "Delete cached data",
  handler: async (argv) => {
    const config = createConfig()
    const cache = createCacheProvider(config, argv)
    const reporter = createReporter(argv)
    cache.cleanup()
    reporter.info("Cache deleted")
  },
}

export default command
