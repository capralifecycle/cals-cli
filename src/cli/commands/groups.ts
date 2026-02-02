import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { findUp } from "find-up"
import yaml from "js-yaml"
import type { CommandModule } from "yargs"
import { DefinitionFile } from "../../definition"
import { createReporter } from "../util"

const CALS_YAML = ".cals.yaml"

interface CalsManifest {
  version: 2
  githubOrganization: string
  resourcesDefinition: {
    path: string
  }
}

const command: CommandModule = {
  command: "groups",
  describe: "List available project groups from the definition file",
  builder: (yargs) => yargs,
  handler: async () => {
    const reporter = createReporter()

    const manifestPath = await findUp(CALS_YAML)
    if (manifestPath === undefined) {
      reporter.error(`File ${CALS_YAML} not found`)
      process.exitCode = 1
      return
    }

    const manifest: CalsManifest = yaml.load(
      fs.readFileSync(manifestPath, "utf-8"),
    ) as CalsManifest

    const definitionPath = path.resolve(
      path.dirname(manifestPath),
      manifest.resourcesDefinition.path,
    )

    if (!fs.existsSync(definitionPath)) {
      reporter.error(`Definition file not found: ${definitionPath}`)
      process.exitCode = 1
      return
    }

    const definition = await new DefinitionFile(definitionPath).getDefinition()
    const projectNames = definition.projects
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b))

    for (const name of projectNames) {
      reporter.log(name)
    }
  },
}

export default command
