import { SnykProject } from "./types"
import { getGitHubRepo } from "./util"

describe("getGitHubRepo", () => {
  it("can parse value that contains a file path", () => {
    const project = {
      name: "capralifecycle/some-repo:package.json",
      origin: "github",
    } as SnykProject

    expect(getGitHubRepo(project)).toStrictEqual({
      owner: "capralifecycle",
      name: "some-repo",
    })
  })

  it("can parse value that contains a deep file path", () => {
    const project = {
      name: "capralifecycle/some-repo:some/dir/package.json",
      origin: "github",
    } as SnykProject

    expect(getGitHubRepo(project)).toStrictEqual({
      owner: "capralifecycle",
      name: "some-repo",
    })
  })

  it("can parse value that does not contain a file path", () => {
    const project = {
      name: "capralifecycle/some-repo",
      origin: "github",
    } as SnykProject

    expect(getGitHubRepo(project)).toStrictEqual({
      owner: "capralifecycle",
      name: "some-repo",
    })
  })
})
