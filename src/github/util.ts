import { Repo } from "./types"

export const getGroup = (repo: Repo) => {
  const projectTopics: string[] = []
  let isInfra = false

  repo.repositoryTopics.edges.forEach(edge => {
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

const ifnull = <T>(a: T | null, other: T) => (a === null ? other : a)

export const getGroupedRepos = (repos: Repo[]) =>
  Object.values(
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

export const includesTopic = (repo: Repo, topic: string) =>
  repo.repositoryTopics.edges.some(it => it.node.topic.name === topic)

export const isAbandoned = (repo: Repo) =>
  includesTopic(repo, "abandoned") || repo.isArchived

export const undefinedForNotFound = async <T>(
  value: Promise<T>,
): Promise<T | undefined> => {
  try {
    return await value
  } catch (e) {
    if (e.name === "HttpError" && e.status === 404) {
      return undefined
    } else {
      throw e
    }
  }
}
