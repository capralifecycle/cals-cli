import type { Repo } from "./types"

export function getGroup(repo: Repo): string | null {
  const projectTopics: string[] = []
  let isInfra = false

  repo.repositoryTopics.edges.forEach((edge) => {
    const name = edge.node.topic.name
    if (name.startsWith("customer-")) {
      projectTopics.push(name.substring(9))
    }
    if (name.startsWith("project-")) {
      projectTopics.push(name.substring(8))
    }
    if (name === "infrastructure") {
      isInfra = true
    }
  })

  if (projectTopics.length > 1) {
    console.warn(
      `Repo ${repo.name} has multiple project groups: ${projectTopics.join(
        ", ",
      )}. Picking first`,
    )
  }

  if (projectTopics.length > 0) {
    return projectTopics[0]
  }

  if (isInfra) {
    return "infrastructure"
  }

  return null
}

function ifnull<T>(a: T | null, other: T) {
  return a === null ? other : a
}

export function getGroupedRepos(repos: Repo[]): {
  name: string
  items: Repo[]
}[] {
  return Object.values(
    repos.reduce<{
      [key: string]: {
        name: string
        items: Repo[]
      }
    }>((acc, repo) => {
      const group = ifnull(getGroup(repo), "(unknown)")
      const value = acc[group] || { name: group, items: [] }

      return {
        ...acc,
        [group]: {
          ...value,
          items: [...value.items, repo],
        },
      }
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name))
}

export function includesTopic(repo: Repo, topic: string): boolean {
  return repo.repositoryTopics.edges.some((it) => it.node.topic.name === topic)
}
