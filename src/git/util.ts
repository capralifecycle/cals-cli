export function wasUpdated(output: string): boolean {
  return output.startsWith("Updating ")
}

export function getUpdateRange(
  output: string,
): { from: string; to: string } | null {
  const match = /Updating ([a-f0-9]+)\.\.([a-f0-9]+)\n/.exec(output)
  if (match === null) {
    return null
  }
  return {
    from: match[1],
    to: match[2],
  }
}

export function getCompareLink(
  range: {
    from: string
    to: string
  },
  owner: string,
  name: string,
): string {
  const compare = `${range.from}...${range.to}`
  return `https://github.com/${owner}/${name}/compare/${compare}`
}

/**
 * Parse output from `git shortlog -c`.
 */
export function parseShortlogSummary(value: string): {
  name: string
  count: number
}[] {
  const matches = [...value.matchAll(/^\s*(\d+)\s+(.+)$/gm)]
  return matches.map((it) => ({
    name: it[2],
    count: Number.parseInt(it[1], 10),
  }))
}
