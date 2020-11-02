/**
 * Reorder a list to preserve same order as it had previously.
 *
 * Not a very pretty algorithm but it works for us.
 */
export function reorderListToSimilarAsBefore<T>(
  oldList: T[],
  updatedList: T[],
  selector: (item: T) => string,
  insertLast = false,
): T[] {
  let result: T[] = []

  // Keep items present in old list.
  let remaining1 = [...updatedList]
  for (const old of oldList) {
    let found = false
    for (const it of remaining1) {
      if (selector(it) === selector(old)) {
        found = true
        result.push(it)
      }
    }
    if (found) {
      remaining1 = remaining1.filter((it) => selector(old) !== selector(it))
    }
  }

  const remaining = updatedList.filter(
    (updated) => !result.some((it) => selector(it) == selector(updated)),
  )

  if (insertLast) {
    result.push(...remaining)
  } else {
    // Insert remaining at first position by ordering.
    for (const it of remaining) {
      let found = false
      for (let i = 0; i < result.length; i++) {
        if (selector(result[i]).localeCompare(selector(it)) > 0) {
          found = true
          result = [...result.slice(0, i), it, ...result.slice(i)]
          break
        }
      }
      if (!found) {
        result.push(it)
      }
    }
  }

  return result
}
