import fs from "fs"
import yaml from "js-yaml"
import pLimit from "p-limit"
import path from "path"
import { sprintf } from "sprintf-js"
import { CommandModule } from "yargs"
import { Config } from "../../../config"
import { GitRepo, UpdateResult } from "../../../git/GitRepo"
import { getCompareLink } from "../../../git/util"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Repo as GitHubRepo } from "../../../github/types"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const CALS_YAML = ".cals.yaml"
const CALS_LOG = ".cals.log"

interface Repo {
  github: GitHubRepo
  git: GitRepo
  name: string
}

interface RepoWithUpdateResult extends Repo {
  updateResult: UpdateResult
}

async function appendFile(path: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.appendFile(path, data, { encoding: "utf-8" }, (err) => {
      if (err !== null) {
        reject(err)
      }
      resolve()
    })
  })
}

/**
 * Structure for CALS_YAML file.
 */
interface CalsManifest {
  version: 1
  githubOrganization: string
}

async function updateRepos(
  reporter: Reporter,
  items: Repo[],
): Promise<RepoWithUpdateResult[]> {
  // Perform git operations in parallel, but limit how much.
  const semaphore = pLimit(30)

  const promises = items.map((repo) =>
    semaphore(async () => {
      try {
        return {
          ...repo,
          updateResult: await repo.git.update(),
        }
      } catch (e) {
        reporter.error(`Failed for ${repo.name} - skipping. ${e}`)
        return null
      }
    }),
  )

  return (await Promise.all(promises)).filter(
    (it): it is RepoWithUpdateResult => it !== null,
  )
}

const sync = async (
  reporter: Reporter,
  config: Config,
  github: GitHubService,
  cals: CalsManifest,
) => {
  const githubRepos = await github.getOrgRepoList({
    org: cals.githubOrganization,
  })

  const githubReposDict = githubRepos.reduce<{
    [key: string]: GitHubRepo
  }>((acc, cur) => ({ ...acc, [cur.name]: cur }), {})

  const dirs = fs
    .readdirSync(config.cwd)
    .filter((it) => fs.statSync(path.join(config.cwd, it)).isDirectory())
    // Skip hidden folders
    .filter((it) => !it.startsWith("."))
    .sort((a, b) => a.localeCompare(b))

  const unknownDirs: string[] = []
  const archivedRepos: Repo[] = []
  const foundRepos: Repo[] = []

  // Categorize all dirs.
  for (const dirname of dirs) {
    if (!(dirname in githubReposDict)) {
      unknownDirs.push(dirname)
      continue
    }

    const repoContainer: Repo = {
      github: githubReposDict[dirname],
      git: new GitRepo(dirname, async (result) => {
        await appendFile(
          CALS_LOG,
          JSON.stringify({
            time: new Date().toISOString(),
            context: dirname,
            type: "exec-result",
            payload: result,
          }) + "\n",
        )
      }),
      name: dirname,
    }

    if (repoContainer.github.isArchived) {
      archivedRepos.push(repoContainer)
    }

    foundRepos.push(repoContainer)
  }

  for (const it of unknownDirs) {
    reporter.warn(
      sprintf(
        "%-30s  <-- Not found in repository list (maybe changed name?)",
        it,
      ),
    )
  }

  // Report archived repos.
  if (archivedRepos.length > 0) {
    reporter.info("Archived repos:")
    for (const it of archivedRepos) {
      reporter.info(`  ${it.name}`)
    }

    const thisDirName = path.basename(process.cwd())
    const archiveDir = `../${thisDirName}-archive`
    const hasArchiveDir = fs.existsSync(archiveDir)

    if (hasArchiveDir) {
      reporter.info("To move these:")
      for (const it of archivedRepos) {
        reporter.info(`  mv ${it.name} ${archiveDir}/`)
      }
    }
  }

  // Report missing repos.
  const missingRepos = githubRepos.filter(
    (repo) => !repo.isArchived && !foundRepos.some((it) => it.github === repo),
  )
  if (missingRepos.length > 0) {
    reporter.info("Repositories not cloned:")
    for (const it of missingRepos) {
      reporter.info(`  ${it.name}`)
    }
    reporter.info("To clone these run:")
    reporter.info(
      `  cals github generate-clone-commands --org ${cals.githubOrganization} --all -x | bash`,
    )
  }

  // Handle identified repos.

  const updateResults = await updateRepos(reporter, foundRepos)

  const dirtyList: RepoWithUpdateResult[] = []

  for (const repo of updateResults) {
    const { updated, dirty, updatedRange } = repo.updateResult

    if (dirty) {
      dirtyList.push(repo)
    }

    if (!updated) {
      continue
    }

    reporter.info(`Updated: ${repo.name}`)
    if (updatedRange) {
      const authors = (await repo.git.getAuthorsForRange(updatedRange))
        .map((it) => `${it.name} (${it.count})`)
        .join(", ")

      reporter.info(
        `  ${getCompareLink(updatedRange, repo.github)} - ${authors}`,
      )
    }
  }

  // Intentionally put dirty at the end, as the user needs to do something here.
  for (const repo of dirtyList) {
    reporter.warn(`Dirty path: ${repo.name} - handle manually`)
  }
}

function loadCalsManifest(reporter: Reporter): CalsManifest | null {
  if (!fs.existsSync(CALS_YAML)) {
    reporter.error(`File ${CALS_YAML} does not exist. See help`)
    process.exitCode = 1
    return null
  }

  // TODO: Verify file has expected contents.
  //  (Can we easily generate schema for type and verify?)
  const cals: CalsManifest = yaml.safeLoad(fs.readFileSync(CALS_YAML, "utf-8"))

  if (cals.version !== 1) {
    throw new Error(`Unexpected version in ${CALS_YAML}`)
  }

  return cals
}

const command: CommandModule = {
  command: "sync",
  describe: "Sync repositories for working directory",
  builder: (yargs) =>
    yargs.usage(`cals github sync

Synchronize all checked out GitHub repositories within the working directory.

A special file "${CALS_YAML}" must exist which describes how
the directory should be synced. Template for the file:

  version: 1
  githubOrganization: <github-org-name>

Only repositories for one GitHub organization is supported.

This command will:

  - Pull latest code. Dirty repositories and those not having master
    as active branch will only be fetched and working tree will be left
    unchanged.
    Later we will try to do some best effort in cleaning up in some
    situations and change to master branch if possible.
  - Report missing repos.
  - Report archived repos.

The file "${CALS_LOG}" is used as a low-level log file
for what has happened. The Git output when changes are seen
will be stored there.`),
  handler: async (argv) => {
    const config = createConfig()
    const github = await createGitHubService(
      config,
      createCacheProvider(config, argv),
    )
    const reporter = createReporter(argv)
    const cals = loadCalsManifest(reporter)
    if (cals === null) return

    return sync(reporter, config, github, cals)
  },
}

export default command
