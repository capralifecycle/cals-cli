import { CommandModule } from "yargs"
import {
  DefinitionFile,
  getRepoId,
  getRepos,
} from "../../../definition/definition"
import { createSnykService, SnykService } from "../../../snyk/service"
import { SnykGitHubRepo } from "../../../snyk/types"
import { getGitHubRepo } from "../../../snyk/util"
import { Reporter } from "../../reporter"
import {
  createConfig,
  createReporter,
  definitionFileOptionName,
  definitionFileOptionValue,
  getDefinitionFile,
} from "../../util"

async function sync({
  reporter,
  snyk,
  definitionFile,
}: {
  reporter: Reporter
  snyk: SnykService
  definitionFile: DefinitionFile
}) {
  const definition = await definitionFile.getDefinition()

  const knownRepos = (await snyk.getProjects(definition))
    .map((it) => getGitHubRepo(it))
    .filter((it): it is SnykGitHubRepo => it !== undefined)

  const allReposWithSnyk = getRepos(definition).filter(
    (it) => it.repo.snyk === true,
  )

  const allReposWithSnykStr = allReposWithSnyk.map((it) =>
    getRepoId(it.orgName, it.repo.name),
  )

  const missingInSnyk = allReposWithSnyk.filter(
    (it) =>
      !knownRepos.some(
        (r) => r.owner === it.orgName && r.name === it.repo.name,
      ),
  )

  const extraInSnyk = knownRepos.filter(
    (it) => !allReposWithSnykStr.includes(`${it.owner}/${it.name}`),
  )

  if (missingInSnyk.length === 0) {
    reporter.info("All seems fine")
  } else {
    missingInSnyk.forEach((it) => {
      reporter.info(`Not in Snyk: ${it.project.name} / ${it.repo.name}`)
    })
    extraInSnyk.forEach((it) => {
      reporter.info(`Should not be in Snyk? ${it.owner}/${it.name}`)
    })
  }
}

const command: CommandModule = {
  command: "sync",
  describe: "Sync Snyk projects (currently only reports, no automation)",
  builder: (yargs) =>
    yargs.option(definitionFileOptionName, definitionFileOptionValue),
  handler: async (argv) =>
    sync({
      reporter: createReporter(argv),
      snyk: await createSnykService(createConfig()),
      definitionFile: getDefinitionFile(argv),
    }),
}

export default command
