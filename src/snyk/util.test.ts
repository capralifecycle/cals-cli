import { SnykProject } from "./types"
import { getGitHubRepo } from "./util"
import { it, expect, describe } from "vitest"

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

  it("can extract value for cli project with http url", () => {
    // noinspection HttpUrlsUsage
    const project = {
      origin: "cli",
      remoteRepoUrl: "http://github.com/capralifecycle/some-repo.git",
    } as SnykProject

    expect(getGitHubRepo(project)).toStrictEqual({
      owner: "capralifecycle",
      name: "some-repo",
    })
  })

  it("can extract value for cli project with https url", () => {
    const project = {
      origin: "cli",
      remoteRepoUrl: "https://github.com/capralifecycle/some-repo.git",
    } as SnykProject

    expect(getGitHubRepo(project)).toStrictEqual({
      owner: "capralifecycle",
      name: "some-repo",
    })
  })

  it("does not fail for unknown cli project", () => {
    const project = {
      origin: "cli",
      remoteRepoUrl: "garbage",
    } as SnykProject

    expect(getGitHubRepo(project)).toBeUndefined()
  })
})
