import fs from "node:fs"
import process from "node:process"
import { findUp } from "find-up"
import yaml from "js-yaml"
import pLimit from "p-limit"
import path from "path"
import { read } from "read"
import type { CommandModule } from "yargs"
import type { Config } from "../../../config"
import { DefinitionFile, getRepos } from "../../../definition"
import type {
  Definition,
  DefinitionRepo,
  GetReposResponse,
} from "../../../definition/types"
import { CloneType, GitRepo, type UpdateResult } from "../../../git/GitRepo"
import { getCompareLink } from "../../../git/util"
import {
  createGitHubService,
  type GitHubService,
} from "../../../github/service"
import type { Reporter } from "../../reporter"
import { createCacheProvider, createConfig, createReporter } from "../../util"

const CALS_YAML = ".cals.yaml"
const CALS_LOG = ".cals.log"

interface Alias {
  group: string
  name: string
}

interface ExpectedRepo {
  id: string
  org: string
  group: string
  name: string
  archived: boolean
  aliases: Alias[]
}

interface ActualRepo extends ExpectedRepo {
  actualRelpath: string
  git: GitRepo
}

interface RepoWithUpdateResult extends ActualRepo {
  updateResult: UpdateResult
}

/**
 * The contents here will be different on Windows due to
 * backward slashes in paths.
 */
function getRelpath(it: { group: string; name: string }): string {
  return path.join(it.group, it.name)
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

export function getAliases(repo: DefinitionRepo): Alias[] {
  return (repo.previousNames ?? []).map((it) => ({
    group: it.project,
    name: it.name,
  }))
}

async function updateReposInParallel(
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
        reporter.error(`Failed for ${repo.actualRelpath} - skipping. ${e}`)
        return null
      }
    }),
  )

  return (await Promise.all(promises)).filter(
    (it): it is RepoWithUpdateResult => it !== null,
  )
}

const botAuthors = ["renovate", "jenkins", "snyk-"]

function isBotAuthor(name: string): boolean {
  return botAuthors.some((author) => name.toLowerCase().includes(author))
}

function formatAuthorAndCount(
  reporter: Reporter,
  name: string,
  count: number,
): string {
  const text = `${name} (${count})`

  if (isBotAuthor(name)) {
    return reporter.format.grey(text)
  }
  return reporter.format.greenBright(text)
}

async function updateRepos(reporter: Reporter, foundRepos: ActualRepo[]) {
  const updateResults = await updateReposInParallel(reporter, foundRepos)

  const dirtyList: RepoWithUpdateResult[] = []

  for (const repo of updateResults) {
    const { updated, dirty, updatedRange } = repo.updateResult

    if (dirty) {
      dirtyList.push(repo)
    }

    if (!updated) {
      continue
    }

    const authors = updatedRange
      ? await repo.git.getAuthorsForRange(updatedRange)
      : undefined

    // We only focus on changes made by humans, which we make
    // green while keeping the other changes gray.
    const repoNameFormat = authors?.every(({ name }) => isBotAuthor(name))
      ? reporter.format.gray
      : reporter.format.greenBright

    reporter.info(`Updated: ${repoNameFormat(repo.id)}`)
    if (updatedRange && authors) {
      const authorsFormatted = authors
        .map((it) => formatAuthorAndCount(reporter, it.name, it.count))
        .join(reporter.format.grey(", "))

      reporter.info(
        reporter.format.grey(
          `  ${getCompareLink(updatedRange, repo.org, repo.name)} - `,
        ) + authorsFormatted,
      )
    }
  }

  // Intentionally report dirty after the loop, as the user needs to do something here.
  for (const repo of dirtyList) {
    reporter.warn(`Dirty path: ${repo.actualRelpath} - handle manually`)
  }
}

function guessDefinitionRepoName(
  rootdir: string,
  cals: CalsManifest,
): string | null {
  const p = path.resolve(rootdir, cals.resourcesDefinition.path)

  const relativePath = path.relative(rootdir, p)
  if (relativePath.slice(0, 1) == ".") {
    return null
  }

  const parts = relativePath.split("/")
  if (parts.length < 2) {
    return null
  }

  // This will match the second directory name from the rootdir,
  // which is supposed to be the repository name.
  return parts[1]
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

async function getReposInOrg(
  cals: CalsManifest,
  rootdir: string,
): Promise<GetReposResponse[]> {
  const definition = await getDefinition(rootdir, cals)
  return getRepos(definition)
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
}

function getExpectedRepo(item: GetReposResponse): ExpectedRepo {
  return {
    id: `${item.project.name}/${item.repo.name}`,
    org: item.orgName,
    group: item.project.name,
    name: item.repo.name,
    archived: !!item.repo.archived,
    aliases: getAliases(item.repo),
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

function getDefinitionRepo(
  rootdir: string,
  reposInOrg: GetReposResponse[],
  cals: CalsManifest,
): ActualRepo | null {
  const definitionRepoName = guessDefinitionRepoName(rootdir, cals)
  if (definitionRepoName == null) {
    return null
  }

  const repo = reposInOrg.find((it) => it.repo.name === definitionRepoName)
  if (repo === undefined) {
    return null
  }

  const expectedRepo = getExpectedRepo(repo)

  return {
    ...expectedRepo,
    actualRelpath: getRelpath(expectedRepo),
    git: getGitRepo(rootdir, getRelpath(expectedRepo)),
  }
}

async function getExpectedRepos(
  reporter: Reporter,
  github: GitHubService,
  cals: CalsManifest,
  rootdir: string,
): Promise<{
  expectedRepos: ExpectedRepo[]
  definitionRepo: ExpectedRepo | null
}> {
  const githubRepos = await github.getOrgRepoList({
    org: cals.githubOrganization,
  })

  // The resources-definition we will read might be out-of-sync.
  // If the file is part of a repository we will be syncing, we
  // do a pre-sync of this repo and re-read the file afterwards.
  let reposInOrg = await getReposInOrg(cals, rootdir)
  const definitionRepo = getDefinitionRepo(rootdir, reposInOrg, cals)
  if (definitionRepo !== null) {
    reporter.info("Pre-syncing resources-definition")
    await updateRepos(reporter, [definitionRepo])
    reposInOrg = await getReposInOrg(cals, rootdir)
  }

  const expectedRepos: ExpectedRepo[] = []

  for (const item of reposInOrg) {
    const githubRepo = githubRepos.find((it) => it.name === item.repo.name)
    if (githubRepo === undefined) {
      reporter.warn(`Repo not found in GitHub - ignoring: ${item.repo.name}`)
      continue
    }

    expectedRepos.push(getExpectedRepo(item))
  }

  return {
    expectedRepos,
    definitionRepo,
  }
}

async function getInput(prompt: string): Promise<string> {
  return read({
    prompt,
    timeout: 60000,
  })
}

async function askCloneType(): Promise<CloneType | null> {
  const cont = await getInput(
    "Clone repos? [h=using https, s=using ssh, other value to abort]: ",
  )

  switch (cont) {
    case "h":
      return CloneType.HTTPS
    case "s":
      return CloneType.SSH
    default:
      return null
  }
}

async function askMoveConfirm(): Promise<boolean> {
  const cont = await getInput("Move repos? [y/n]: ")

  switch (cont) {
    case "y":
      return true
    default:
      return false
  }
}

async function sync({
  reporter,
  github,
  cals,
  rootdir,
  askClone,
  askMove,
}: {
  reporter: Reporter
  github: GitHubService
  cals: CalsManifest
  rootdir: string
  askClone: boolean
  askMove: boolean
}) {
  const { expectedRepos, definitionRepo } = await getExpectedRepos(
    reporter,
    github,
    cals,
    rootdir,
  )

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

      const expectedRepo = expectedRepos.find(
        (it) =>
          getRelpath(it) === p ||
          it.aliases.some((alias) => getRelpath(alias) === p),
      )
      if (expectedRepo === undefined) {
        unknownDirs.push(p)
        continue
      }

      foundRepos.push({
        ...expectedRepo,
        actualRelpath: p,
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
      reporter.info(`  ${it.actualRelpath}`)
    }

    const thisDirName = path.basename(process.cwd())
    const archiveDir = `../${thisDirName}-archive`
    const hasArchiveDir = fs.existsSync(archiveDir)

    if (hasArchiveDir) {
      reporter.info("To move these:")
      for (const it of archivedRepos) {
        // TODO: Grouped dir in archive?
        reporter.info(`  mv ${it.actualRelpath} ${archiveDir}/`)
      }
    }
  }

  // Report renamed/moved repos.
  const movedRepos = foundRepos.filter(
    (it) => getRelpath(it) !== it.actualRelpath,
  )
  if (movedRepos.length > 0) {
    reporter.info("Repositories renamed:")
    for (const it of movedRepos) {
      reporter.info(`  ${it.actualRelpath} -> ${getRelpath(it)}`)
    }

    if (!askMove) {
      reporter.info("To move these repos on disk add --ask-move option")
    } else {
      const shouldMove = await askMoveConfirm()
      if (shouldMove) {
        for (const it of movedRepos) {
          const src = path.join(rootdir, it.actualRelpath)
          const dest = path.join(rootdir, getRelpath(it))
          const destParent = path.join(rootdir, it.group)
          if (fs.existsSync(dest)) {
            throw new Error(
              `Target directory already exists: ${dest} - cannot move ${it.actualRelpath}`,
            )
          }

          reporter.info(`Moving ${it.actualRelpath} -> ${getRelpath(it)}`)

          if (!fs.existsSync(destParent)) {
            await fs.promises.mkdir(destParent, { recursive: true })
          }

          await fs.promises.rename(src, dest)
        }

        // We would have to update expectedRepos if we want to continue.
        // Let's try keeping this simple.
        reporter.info("Not doing more work - rerun to continue")
        return
      }
    }
  }

  // Report missing repos.
  const missingRepos = expectedRepos.filter(
    (repo) => !repo.archived && !foundRepos.some((it) => it.id === repo.id),
  )
  if (missingRepos.length > 0) {
    reporter.info("Repositories not cloned:")
    for (const it of missingRepos) {
      reporter.info(`  ${it.id}`)
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
          reporter.info(`Cloning ${it.id}`)
          const git = getGitRepo(rootdir, getRelpath(it))
          await git.cloneGitHubRepo(it.org, it.name, cloneType)
        }
      }
    }
  }

  const reposToUpdate = foundRepos.filter(
    (it) =>
      // Avoid double-processing the defintion repo.
      definitionRepo?.id !== it.id,
  )
  reporter.info(`${reposToUpdate.length} repos identified to be updated`)
  await updateRepos(reporter, reposToUpdate)

  // Report repos with changes ahead.
  for (const repo of foundRepos) {
    if (await repo.git.hasUnpushedCommits()) {
      reporter.warn(`Has unpushed commits: ${repo.actualRelpath}`)
    }
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
  const cals: CalsManifest = yaml.load(fs.readFileSync(p, "utf-8")) as any

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
    yargs
      .option("ask-clone", {
        alias: "c",
        describe: "Ask to clone new missing repos",
        type: "boolean",
      })
      .option("ask-move", {
        describe: "Ask to actual move renamed repos",
        type: "boolean",
      })
      .usage(`cals github sync

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
    const github = await createGitHubService({
      config,
      cache: createCacheProvider(config, argv),
    })
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
      askMove: !!argv["ask-move"],
    })
  },
}

export default command
