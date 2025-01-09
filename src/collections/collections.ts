export function groupBy<T>(
  array: T[],
  iteratee: (item: T) => string,
): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const key = iteratee(item)
      if (!result[key]) {
        result[key] = []
      }
      result[key].push(item)
      return result
    },
    {} as Record<string, T[]>,
  )
}

export function uniq<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

export function sortBy<T>(arr: T[], getKey: (item: T) => string): T[] {
  return [...arr].sort((a, b) => getKey(a).localeCompare(getKey(b)))
}

export function sumBy<T>(array: T[], iteratee: (item: T) => number): number {
  return array.reduce((sum, item) => sum + iteratee(item), 0)
}
