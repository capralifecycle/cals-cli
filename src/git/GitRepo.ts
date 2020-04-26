import execa, { ExecaReturnValue } from "execa"
import { getUpdateRange, parseShortlogSummary, wasUpdated } from "./util"

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
  private readonly logCommand: (result: ExecaReturnValue) => Promise<void>

  constructor(
    path: string,
    logCommand: (result: ExecaReturnValue) => Promise<void>,
  ) {
    this.path = path
    this.logCommand = logCommand
  }

  private async git(args: string[]): Promise<ExecaReturnValue> {
    try {
      const result = await execa("git", args, {
        cwd: this.path,
      })
      await this.logCommand(result)
      return result
    } catch (e) {
      await this.logCommand(e)
      throw e
    }
  }

  async getCurrentBranch() {
    return (await this.git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout
  }

  async hasChangesInProgress(): Promise<boolean> {
    const result = await this.git(["status", "--short"])

    // Ignore untracked files.
    return result.stdout.replace(/^\?\?.+$/gm, "").length > 0
  }

  async getAuthorsForRange(range: {
    from: string
    to: string
  }): Promise<
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

    return {
      dirty: false,
      updated: wasUpdated(result.stdout),
      updatedRange: getUpdateRange(result.stdout) ?? undefined,
    }
  }
}
