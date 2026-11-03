import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getCompareLink, getUpdateRange, parseShortlogSummary } from "./util"

describe("getUpdateRange", () => {
  it("should return range when given proper text", () => {
    const stdout = "Updating ff4f0fa..ccb7d01\n" + "Fast-forward\n..."
    assert.deepEqual(getUpdateRange(stdout), {
      from: "ff4f0fa",
      to: "ccb7d01",
    })
  })

  it("should return null for unknown text", () => {
    const stdout = "Some other message\n" + "Fast-forward\n..."
    assert.equal(getUpdateRange(stdout), null)
  })
})

describe("getCompareLink", () => {
  it("should return compare link", () => {
    assert.equal(
      getCompareLink(
        { from: "ff4f0fa", to: "ccb7d01" },
        "repoowner",
        "reponame",
      ),
      "https://github.com/repoowner/reponame/compare/ff4f0fa...ccb7d01",
    )
  })
})

describe("parseShortlogSummary", () => {
  it("should handle empty output", () => {
    assert.deepEqual(parseShortlogSummary(""), [])
  })

  it("should handle one line of data", () => {
    const output = "     7\tRenovate Bot\n"
    assert.deepEqual(parseShortlogSummary(output), [
      {
        name: "Renovate Bot",
        count: 7,
      },
    ])
  })

  it("should handle multiple lines of data", () => {
    const output =
      "     7\tRenovate Bot\n     2\tOther User\n    45\tThird User\n"
    assert.deepEqual(parseShortlogSummary(output), [
      {
        name: "Renovate Bot",
        count: 7,
      },
      {
        name: "Other User",
        count: 2,
      },
      {
        name: "Third User",
        count: 45,
      },
    ])
  })
})
