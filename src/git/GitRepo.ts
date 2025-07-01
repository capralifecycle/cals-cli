import fs from "node:fs"
import path from "node:path"
import { execa, type Result } from "execa"
import { getUpdateRange, parseShortlogSummary, wasUpdated } from "./util"

export enum CloneType {
  HTTPS = 0,
  SSH = 1,
}

export interface UpdateResult {
  dirty: boolean
  updated: boolean
  updatedRange?: {
    from: string
    to: string
  }
}

export class GitRepo {
  private readonly path: string
  private readonly logCommand: (result: Result) => Promise<void>

  constructor(path: string, logCommand: (result: Result) => Promise<void>) {
    this.path = path
    this.logCommand = logCommand
  }

  async cloneGitHubRepo(
    org: string,
    name: string,
    cloneType: CloneType,
  ): Promise<void> {
    const parent = path.dirname(this.path)
    if (!fs.existsSync(parent)) {
      await fs.promises.mkdir(parent, { recursive: true })
    }

    const cloneUrl =
      cloneType === CloneType.SSH
        ? `git@github.com:${org}/${name}.git`
        : `https://github.com/${org}/${name}.git`

    try {
      const result = await execa("git", ["clone", cloneUrl, this.path], {
        cwd: parent,
      })
      await this.logCommand(result)
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.logCommand(e)
      throw e
    }
  }

  private async git(args: string[]): Promise<Result> {
    try {
      const result: Result = await execa("git", args, {
        cwd: this.path,
      })
      await this.logCommand(result)
      return result
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.logCommand(e)
      throw e
    }
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.git(["rev-parse", "--abbrev-ref", "HEAD"])
    // check if stdout is a string
    if (typeof result.stdout !== "string") {
      throw new Error("stdout is not a string")
    }
    return result.stdout
  }

  async hasChangesInProgress(): Promise<boolean> {
    const result = await this.git(["status", "--short"])

    if (typeof result.stdout !== "string") {
      throw new Error("stdout is not a string")
    }

    // Ignore untracked files.
    return result.stdout.replace(/^\?\?.+$/gm, "").length > 0
  }

  async hasUnpushedCommits(): Promise<boolean> {
    const result = await this.git(["status", "-sb"])
    if (typeof result.stdout !== "string") {
      throw new Error("stdout is not a string")
    }
    return result.stdout.includes("[ahead")
  }

  async getAuthorsForRange(range: { from: string; to: string }): Promise<
    {
      name: string
      count: number
    }[]
  > {
    const result = await this.git([
      "shortlog",
      "-s",
      `${range.from}..${range.to}`,
    ])

    if (typeof result.stdout !== "string") {
      throw new Error("stdout is not a string")
    }

    return parseShortlogSummary(result.stdout)
  }

  async update(): Promise<UpdateResult> {
    const fetchOnly = async () => {
      await this.git(["fetch"])
      return {
        updated: false,
        dirty: true,
      }
    }

    if (await this.hasChangesInProgress()) {
      return fetchOnly()
    }

    // TODO: Should have an option if we want to switch branch or not.
    if ((await this.getCurrentBranch()) !== "master") {
      return fetchOnly()
    }

    // TODO: Report which dirs we change branches for.
    // await execa("git", ["checkout", "master"], {
    //   cwd: path,
    // })

    const result = await this.git(["pull", "--rebase"])
    if (typeof result.stdout !== "string") {
      throw new Error("stdout is not a string")
    }

    return {
      dirty: false,
      updated: wasUpdated(result.stdout),
      updatedRange: getUpdateRange(result.stdout) ?? undefined,
    }
  }
}
