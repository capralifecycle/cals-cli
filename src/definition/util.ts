import { Config } from '../config'

export function getDefinitionFile(config: Config) {
  return config.requireConfig('githubDefinitionFile')
}
