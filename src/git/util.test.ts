import { getCompareLink, getUpdateRange, parseShortlogSummary } from "./util"

describe("getUpdateRange", () => {
  it("should return range when given proper text", () => {
    const stdout = "Updating ff4f0fa..ccb7d01\n" + "Fast-forward\n..."
    expect(getUpdateRange(stdout)).toStrictEqual({
      from: "ff4f0fa",
      to: "ccb7d01",
    })
  })

  it("should return null for unknown text", () => {
    const stdout = "Some other message\n" + "Fast-forward\n..."
    expect(getUpdateRange(stdout)).toBe(null)
  })
})

describe("getCompareLink", () => {
  it("should return compare link", () => {
    expect(
      getCompareLink(
        { from: "ff4f0fa", to: "ccb7d01" },
        "repoowner",
        "reponame",
      ),
    ).toBe("https://github.com/repoowner/reponame/compare/ff4f0fa...ccb7d01")
  })
})

describe("parseShortlogSummary", () => {
  it("should handle empty output", () => {
    expect(parseShortlogSummary("")).toStrictEqual([])
  })

  it("should handle one line of data", () => {
    const output = "     7\tRenovate Bot\n"
    expect(parseShortlogSummary(output)).toStrictEqual([
      {
        name: "Renovate Bot",
        count: 7,
      },
    ])
  })

  it("should handle multiple lines of data", () => {
    const output =
      "     7\tRenovate Bot\n     2\tOther User\n    45\tThird User\n"
    expect(parseShortlogSummary(output)).toStrictEqual([
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
