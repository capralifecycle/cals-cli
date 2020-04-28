import findUp from "find-up"
import fs from "fs"
import yaml from "js-yaml"
import pLimit from "p-limit"
import path from "path"
import read from "read"
import { CommandModule } from "yargs"
import { Config } from "../../../config"
import { DefinitionFile, getRepos } from "../../../definition/definition"
import { Definition } from "../../../definition/types"
import { CloneType, GitRepo, UpdateResult } from "../../../git/GitRepo"
import { getCompareLink } from "../../../git/util"
import { createGitHubService, GitHubService } from "../../../github/service"
import { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const CALS_YAML = ".cals.yaml"
const CALS_LOG = ".cals.log"

interface ExpectedRepo {
  org: string
  name: string
  group: string
  relpath: string
  archived: boolean
}

interface ActualRepo extends ExpectedRepo {
  git: GitRepo
}

interface RepoWithUpdateResult extends ActualRepo {
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
  version: 2 // Bump this on breaking changes to manifest/command.
  githubOrganization: string
  resourcesDefinition: {
    path: string
    /**
     * If tags are specified, there must be overlap between these tags
     * and the tags for a project.
     */
    tags?: string[]
  }
}

async function updateRepos(
  reporter: Reporter,
  items: ActualRepo[],
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
        reporter.error(`Failed for ${repo.relpath} - skipping. ${e}`)
        return null
      }
    }),
  )

  return (await Promise.all(promises)).filter(
    (it): it is RepoWithUpdateResult => it !== null,
  )
}

async function getDefinition(
  rootdir: string,
  cals: CalsManifest,
): Promise<Definition> {
  const p = path.resolve(rootdir, cals.resourcesDefinition.path)
  if (!fs.existsSync(p)) {
    throw Error(`The file ${p} does not exist`)
  }

  return new DefinitionFile(p).getDefinition()
}

/**
 * Get directory names within a directory.
 */
function getDirNames(parent: string): string[] {
  return (
    fs
      .readdirSync(parent)
      .filter((it) => fs.statSync(path.join(parent, it)).isDirectory())
      // Skip hidden folders
      .filter((it) => !it.startsWith("."))
      .sort((a, b) => a.localeCompare(b))
  )
}

async function getExpectedRepos(
  reporter: Reporter,
  github: GitHubService,
  cals: CalsManifest,
  rootdir: string,
): Promise<ExpectedRepo[]> {
  const githubRepos = await github.getOrgRepoList({
    org: cals.githubOrganization,
  })

  const definition = await getDefinition(rootdir, cals)
  const expectedRepos: ExpectedRepo[] = []

  const reposInOrg = getRepos(definition)
    .filter((it) => it.orgName === cals.githubOrganization)
    .filter(
      (it) =>
        cals.resourcesDefinition.tags === undefined ||
        (it.project.tags || []).some((tag) =>
          cals.resourcesDefinition.tags?.includes(tag),
        ) ||
        // Always include if already checked out to avoid stale state.
        fs.existsSync(path.join(rootdir, it.project.name, it.repo.name)),
    )

  for (const item of reposInOrg) {
    const githubRepo = githubRepos.find((it) => it.name === item.repo.name)
    if (githubRepo === undefined) {
      reporter.warn(`Repo not found in GitHub - ignoring: ${item.repo.name}`)
      continue
    }

    expectedRepos.push({
      org: item.orgName,
      name: item.repo.name,
      group: item.project.name,
      relpath: path.join(item.project.name, item.repo.name),
      archived: !!item.repo.archived,
    })
  }

  return expectedRepos
}

async function askCloneType(): Promise<CloneType | null> {
  const cont = await new Promise<string>((resolve, reject) => {
    read(
      {
        prompt:
          "Clone repos? [h=using https, s=using ssh, other value to abort]: ",
        timeout: 60000,
      },
      (err, answer) => {
        if (err) {
          reject(err)
        }
        resolve(answer)
      },
    )
  })

  switch (cont) {
    case "h":
      return CloneType.HTTPS
    case "s":
      return CloneType.SSH
    default:
      return null
  }
}

function getGitRepo(rootdir: string, relpath: string): GitRepo {
  return new GitRepo(path.resolve(rootdir, relpath), async (result) => {
    await appendFile(
      path.resolve(rootdir, CALS_LOG),
      JSON.stringify({
        time: new Date().toISOString(),
        context: relpath,
        type: "exec-result",
        payload: result,
      }) + "\n",
    )
  })
}

async function sync({
  reporter,
  github,
  cals,
  rootdir,
  askClone,
}: {
  reporter: Reporter
  github: GitHubService
  cals: CalsManifest
  rootdir: string
  askClone: boolean
}) {
  const expectedRepos = await getExpectedRepos(reporter, github, cals, rootdir)

  const unknownDirs: string[] = []
  const foundRepos: ActualRepo[] = []

  // Categorize all dirs.
  for (const topdir of getDirNames(rootdir)) {
    const isGitDir = fs.existsSync(path.join(rootdir, topdir, ".git"))
    if (isGitDir) {
      // Do not traverse deeper inside another Git repo, as that might
      // mean we do not have the proper grouped structure.
      unknownDirs.push(topdir)
      continue
    }

    for (const subdir of getDirNames(path.join(rootdir, topdir))) {
      const p = path.join(topdir, subdir)

      const expectedRepo = expectedRepos.find((it) => it.relpath === p)
      if (expectedRepo === undefined) {
        unknownDirs.push(p)
        continue
      }

      foundRepos.push({
        ...expectedRepo,
        git: getGitRepo(rootdir, p),
      })
    }
  }

  // Report unknown directories.
  if (unknownDirs.length > 0) {
    reporter.warn("Directories not mapped - maybe renamed?")
    for (const it of unknownDirs) {
      reporter.warn(`  ${it}`)
    }
  }

  // Report archived repos.
  const archivedRepos = foundRepos.filter((it) => it.archived)
  if (archivedRepos.length > 0) {
    reporter.info("Archived repos:")
    for (const it of archivedRepos) {
      reporter.info(`  ${it.relpath}`)
    }

    const thisDirName = path.basename(process.cwd())
    const archiveDir = `../${thisDirName}-archive`
    const hasArchiveDir = fs.existsSync(archiveDir)

    if (hasArchiveDir) {
      reporter.info("To move these:")
      for (const it of archivedRepos) {
        // TODO: Grouped dir in archive?
        reporter.info(`  mv ${it.relpath} ${archiveDir}/`)
      }
    }
  }

  // Report missing repos.
  const missingRepos = expectedRepos.filter(
    (repo) =>
      !repo.archived && !foundRepos.some((it) => it.relpath === repo.relpath),
  )
  if (missingRepos.length > 0) {
    reporter.info("Repositories not cloned:")
    for (const it of missingRepos) {
      reporter.info(`  ${it.relpath}`)
    }

    if (!askClone) {
      reporter.info("To clone these repos add --ask-clone option for dialog")
    } else {
      reporter.info(
        "You must already have working credentials for GitHub set up for clone to work",
      )
      const cloneType = await askCloneType()
      if (cloneType !== null) {
        for (const it of missingRepos) {
          reporter.info(`Cloning ${it.relpath}`)
          const git = getGitRepo(rootdir, it.relpath)
          await git.cloneGitHubRepo(it.org, it.name, cloneType)
        }
      }
    }
  }

  // Handle identified repos.

  reporter.info(`${foundRepos.length} repos identified to be updated`)
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

    reporter.info(`Updated: ${repo.relpath}`)
    if (updatedRange) {
      const authors = (await repo.git.getAuthorsForRange(updatedRange))
        .map((it) => `${it.name} (${it.count})`)
        .join(", ")

      reporter.info(
        `  ${getCompareLink(updatedRange, repo.org, repo.name)} - ${authors}`,
      )
    }
  }

  // Intentionally put dirty at the end, as the user needs to do something here.
  for (const repo of dirtyList) {
    reporter.warn(`Dirty path: ${repo.relpath} - handle manually`)
  }
}

async function loadCalsManifest(
  config: Config,
  reporter: Reporter,
): Promise<{
  dir: string
  cals: CalsManifest
} | null> {
  const p = await findUp(CALS_YAML, { cwd: config.cwd })
  if (p === undefined) {
    reporter.error(`File ${CALS_YAML} not found. See help`)
    process.exitCode = 1
    return null
  }

  // TODO: Verify file has expected contents.
  //  (Can we easily generate schema for type and verify?)
  const cals: CalsManifest = yaml.safeLoad(fs.readFileSync(p, "utf-8"))

  if (cals.version !== 2) {
    throw new Error(`Unexpected version in ${p}`)
  }

  return {
    dir: path.dirname(p),
    cals,
  }
}

const command: CommandModule = {
  command: "sync",
  describe: "Sync repositories for working directory",
  builder: (yargs) =>
    yargs.option("ask-clone", {
      alias: "c",
      describe: "Ask to clone new missing repos",
      type: "boolean",
    }).usage(`cals github sync

Synchronize all checked out GitHub repositories within the working directory
grouped by the project in the resource definition file. The command can also
be run in any subdirectory, and it will discover the correct root.

A special file "${CALS_YAML}" must exist which describes how
the directory should be synced. Template for the file:

  version: 2
  githubOrganization: <github-org-name>
  resourcesDefinition:
    path: <path-to-resources.yaml>
    tags:  # optional, will filter by project tags
      - tag1

Only repositories for one GitHub organization is supported.

If repositories are filtered by tags, already existing cloned repos
will override the tag filter even when not matching the tags.

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

    const manifest = await loadCalsManifest(config, reporter)
    if (manifest === null) return
    const { dir, cals } = manifest

    return sync({
      reporter,
      github,
      cals,
      rootdir: dir,
      askClone: !!argv["ask-clone"],
    })
  },
}

export default command
