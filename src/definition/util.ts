import { Config } from "../config"

export function getDefinitionFile(config: Config) {
  if (process.env.CALS_DEFINITION_FILE) {
    return process.env.CALS_DEFINITION_FILE
  }

  return config.requireConfig("definitionFile")
}
