import { groupBy, repeat, sortBy, sumBy } from "lodash-es"
import { sprintf } from "sprintf-js"
import { CommandModule } from "yargs"
import { DefinitionFile, getRepos } from "../../../definition"
import { Project } from "../../../definition"
import { createSnykService, SnykService } from "../../../snyk"
import { SnykProject } from "../../../snyk"
import { getGitHubRepo, getGitHubRepoId } from "../../../snyk"
import { Reporter } from "../../reporter"
import {
  createConfig,
  createReporter,
  definitionFileOptionName,
  definitionFileOptionValue,
  getDefinitionFile,
} from "../../util"

function totalSeverityCount(project: SnykProject) {
  return (
    (project.issueCountsBySeverity.critical ?? 0) +
    project.issueCountsBySeverity.high +
    project.issueCountsBySeverity.medium +
    project.issueCountsBySeverity.low
  )
}

function buildStatsLine(stats: SnykProject["issueCountsBySeverity"]) {
  function item(num: number, str: string) {
    return num === 0 ? repeat(" ", str.length + 4) : sprintf("%3d %s", num, str)
  }

  return sprintf(
    "%s  %s  %s  %s",
    item(stats.critical ?? 0, "critical"),
    item(stats.high, "high"),
    item(stats.medium, "medium"),
    item(stats.low, "low"),
  )
}

async function report({
  reporter,
  snyk,
  definitionFile,
}: {
  reporter: Reporter
  snyk: SnykService
  definitionFile: DefinitionFile
}) {
  const definition = await definitionFile.getDefinition()

  const reposWithIssues = (await snyk.getProjects(definition)).filter(
    (it) => totalSeverityCount(it) > 0,
  )

  const definitionRepos = getRepos(definition)

  function getProject(p: SnykProject) {
    const id = getGitHubRepoId(getGitHubRepo(p))
    const def =
      id === undefined ? undefined : definitionRepos.find((it) => it.id === id)
    return def === undefined ? undefined : def.project
  }

  const enhancedRepos = reposWithIssues.map((repo) => ({
    repo,
    project: getProject(repo),
  }))

  function getProjectName(project: Project | undefined) {
    return project ? project.name : "unknown project"
  }

  const byProjects = sortBy(
    Object.values(
      groupBy(enhancedRepos, (it) =>
        it.project ? it.project.name : "unknown",
      ),
    ),
    (it) => getProjectName(it[0].project),
  )

  if (byProjects.length === 0) {
    reporter.info("No issues found")
  } else {
    reporter.info(
      sprintf(
        "%-70s %s",
        "Total count",
        buildStatsLine({
          critical: sumBy(
            reposWithIssues,
            (it) => it.issueCountsBySeverity.critical ?? 0,
          ),
          high: sumBy(reposWithIssues, (it) => it.issueCountsBySeverity.high),
          medium: sumBy(
            reposWithIssues,
            (it) => it.issueCountsBySeverity.medium,
          ),
          low: sumBy(reposWithIssues, (it) => it.issueCountsBySeverity.low),
        }),
      ),
    )

    reporter.info("Issues by project:")
    byProjects.forEach((repos) => {
      const project = repos[0].project
      const totalCount = {
        critical: sumBy(
          repos,
          (it) => it.repo.issueCountsBySeverity.critical ?? 0,
        ),
        high: sumBy(repos, (it) => it.repo.issueCountsBySeverity.high),
        medium: sumBy(repos, (it) => it.repo.issueCountsBySeverity.medium),
        low: sumBy(repos, (it) => it.repo.issueCountsBySeverity.low),
      }

      reporter.info("")
      reporter.info(
        sprintf(
          "%-70s %s",
          getProjectName(project),
          buildStatsLine(totalCount),
        ),
      )

      for (const { repo } of repos) {
        reporter.info(
          sprintf(
            "  %-68s %s",
            repo.name,
            buildStatsLine(repo.issueCountsBySeverity),
          ),
        )
      }
    })
  }
}

const command: CommandModule = {
  command: "report",
  describe: "Report Snyk projects status",
  builder: (yargs) =>
    yargs.option(definitionFileOptionName, definitionFileOptionValue),
  handler: async (argv) =>
    report({
      reporter: createReporter(argv),
      snyk: createSnykService({ config: createConfig() }),
      definitionFile: getDefinitionFile(argv),
    }),
}

export default command
