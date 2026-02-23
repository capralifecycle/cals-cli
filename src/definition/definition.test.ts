import { promises as fsPromises } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DefinitionFile, parseDefinition } from "./definition"
import { definitionSchema } from "./types"
import type { Definition } from "./types"

async function createTempFile(): Promise<string> {
  const tmpDir = await fsPromises.mkdtemp(join(tmpdir(), "temp-"))
  const tempFilePath = join(tmpDir, "cals-cli")
  await fsPromises.writeFile(tempFilePath, "") // Create an empty file
  return tempFilePath
}

describe("definition", () => {
  it("should error on reading invalid file", async () => {
    const tmpFile = await createTempFile()
    await fsPromises.writeFile(
      tmpFile,
      JSON.stringify({
        some: "invalid",
      }),
    )

    const definitionFile = new DefinitionFile(tmpFile)

    await expect(definitionFile.getDefinition()).rejects.toThrow(
      "Definition content invalid",
    )

    await rm(tmpFile, { force: true })
  })

  it("should successfully parse correct file", async () => {
    const data: Definition = {
      projects: [
        {
          name: "myproject",
          github: [
            {
              organization: "someorg",
              repos: [
                {
                  name: "somerepo",
                },
              ],
            },
          ],
        },
      ],
    }

    const tmpFile = await createTempFile()
    await fsPromises.writeFile(tmpFile, JSON.stringify(data))

    const definitionFile = new DefinitionFile(tmpFile)
    await expect(definitionFile.getDefinition()).resolves.toStrictEqual(data)

    await rm(tmpFile, { force: true })
  })

  it("should reject when projects is missing", () => {
    expect(() => parseDefinition("{}")).toThrow("Definition content invalid")
  })

  it("should reject when project name is missing", () => {
    expect(() =>
      parseDefinition(JSON.stringify({ projects: [{ github: [] }] })),
    ).toThrow("Definition content invalid")
  })

  it("should reject when github organization is missing", () => {
    expect(() =>
      parseDefinition(
        JSON.stringify({
          projects: [{ name: "p", github: [{ repos: [] }] }],
        }),
      ),
    ).toThrow("Definition content invalid")
  })

  it("should reject duplicate project names", () => {
    expect(() =>
      parseDefinition(
        JSON.stringify({
          projects: [
            { name: "dup", github: [] },
            { name: "dup", github: [] },
          ],
        }),
      ),
    ).toThrow("Duplicate project: dup")
  })

  it("should reject duplicate repos", () => {
    expect(() =>
      parseDefinition(
        JSON.stringify({
          projects: [
            {
              name: "p1",
              github: [
                {
                  organization: "org",
                  repos: [{ name: "repo" }],
                },
              ],
            },
            {
              name: "p2",
              github: [
                {
                  organization: "org",
                  repos: [{ name: "repo" }],
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow("Duplicate repo: org/repo")
  })

  it("should accept optional fields", () => {
    const data: Definition = {
      projects: [
        {
          name: "myproject",
          tags: ["tag1", "tag2"],
          github: [
            {
              organization: "someorg",
              repos: [
                {
                  name: "somerepo",
                  archived: true,
                  previousNames: [{ name: "oldname", project: "oldproject" }],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(parseDefinition(JSON.stringify(data))).toStrictEqual(data)
  })

  it("should reject wrong types", () => {
    expect(() =>
      parseDefinition(
        JSON.stringify({
          projects: [
            {
              name: 123,
              github: [],
            },
          ],
        }),
      ),
    ).toThrow("Definition content invalid")
  })
})

// Helpers used by the schema equivalence tests below.
const validPreviousName = { name: "old-repo", project: "old-project" }
const validRepo = { name: "my-repo" }
const validGithubEntry = { organization: "my-org" }
const validProject = { name: "my-project", github: [validGithubEntry] }
const validDefinition = { projects: [validProject] }

function succeeds(input: unknown) {
  return definitionSchema.safeParse(input).success
}

function fails(input: unknown) {
  return !definitionSchema.safeParse(input).success
}

describe("definitionSchema — equivalence with old JSON schema (draft-07)", () => {
  describe("required fields", () => {
    it("requires projects at the top level", () => {
      expect(fails({})).toBe(true)
      expect(succeeds(validDefinition)).toBe(true)
    })

    it("requires project.name", () => {
      const input = { projects: [{ github: [validGithubEntry] }] }
      expect(fails(input)).toBe(true)
    })

    it("requires project.github", () => {
      const input = { projects: [{ name: "p" }] }
      expect(fails(input)).toBe(true)
    })

    it("requires github[].organization", () => {
      const input = { projects: [{ name: "p", github: [{ repos: [] }] }] }
      expect(fails(input)).toBe(true)
    })

    it("requires DefinitionRepo.name", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [{ organization: "org", repos: [{ archived: true }] }],
          },
        ],
      }
      expect(fails(input)).toBe(true)
    })

    it("requires DefinitionRepoPreviousName.name", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [
                  {
                    name: "r",
                    previousNames: [{ project: "old-project" }],
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(fails(input)).toBe(true)
    })

    it("requires DefinitionRepoPreviousName.project", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [
                  {
                    name: "r",
                    previousNames: [{ name: "old-repo" }],
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(fails(input)).toBe(true)
    })
  })

  describe("optional fields", () => {
    it("project.tags is optional", () => {
      const withoutTags = { projects: [{ name: "p", github: [] }] }
      const withTags = {
        projects: [{ name: "p", github: [], tags: ["a", "b"] }],
      }
      expect(succeeds(withoutTags)).toBe(true)
      expect(succeeds(withTags)).toBe(true)
    })

    it("github[].repos is optional", () => {
      const withoutRepos = {
        projects: [{ name: "p", github: [{ organization: "org" }] }],
      }
      const withRepos = {
        projects: [
          { name: "p", github: [{ organization: "org", repos: [] }] },
        ],
      }
      expect(succeeds(withoutRepos)).toBe(true)
      expect(succeeds(withRepos)).toBe(true)
    })

    it("DefinitionRepo.archived is optional", () => {
      const withoutArchived = {
        projects: [
          { name: "p", github: [{ organization: "org", repos: [validRepo] }] },
        ],
      }
      const withArchived = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [{ name: "my-repo", archived: true }],
              },
            ],
          },
        ],
      }
      expect(succeeds(withoutArchived)).toBe(true)
      expect(succeeds(withArchived)).toBe(true)
    })

    it("DefinitionRepo.previousNames is optional", () => {
      const withoutPreviousNames = {
        projects: [
          { name: "p", github: [{ organization: "org", repos: [validRepo] }] },
        ],
      }
      const withPreviousNames = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [
                  { name: "my-repo", previousNames: [validPreviousName] },
                ],
              },
            ],
          },
        ],
      }
      expect(succeeds(withoutPreviousNames)).toBe(true)
      expect(succeeds(withPreviousNames)).toBe(true)
    })
  })

  describe("type enforcement", () => {
    it("rejects non-array projects", () => {
      expect(fails({ projects: "not-an-array" })).toBe(true)
      expect(fails({ projects: 42 })).toBe(true)
      expect(fails({ projects: {} })).toBe(true)
    })

    it("rejects non-string project.name", () => {
      expect(
        fails({ projects: [{ name: 123, github: [] }] }),
      ).toBe(true)
      expect(
        fails({ projects: [{ name: true, github: [] }] }),
      ).toBe(true)
      expect(
        fails({ projects: [{ name: [], github: [] }] }),
      ).toBe(true)
    })

    it("rejects non-array project.github", () => {
      expect(fails({ projects: [{ name: "p", github: "org" }] })).toBe(true)
      expect(fails({ projects: [{ name: "p", github: 1 }] })).toBe(true)
    })

    it("rejects non-string github[].organization", () => {
      expect(
        fails({ projects: [{ name: "p", github: [{ organization: 99 }] }] }),
      ).toBe(true)
      expect(
        fails({
          projects: [{ name: "p", github: [{ organization: false }] }],
        }),
      ).toBe(true)
    })

    it("rejects non-array github[].repos", () => {
      expect(
        fails({
          projects: [
            { name: "p", github: [{ organization: "org", repos: "bad" }] },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-string DefinitionRepo.name", () => {
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [{ organization: "org", repos: [{ name: 42 }] }],
            },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-boolean DefinitionRepo.archived", () => {
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [
                {
                  organization: "org",
                  repos: [{ name: "r", archived: "yes" }],
                },
              ],
            },
          ],
        }),
      ).toBe(true)
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [
                { organization: "org", repos: [{ name: "r", archived: 1 }] },
              ],
            },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-array DefinitionRepo.previousNames", () => {
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [
                {
                  organization: "org",
                  repos: [{ name: "r", previousNames: "old" }],
                },
              ],
            },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-string DefinitionRepoPreviousName.name", () => {
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [
                {
                  organization: "org",
                  repos: [
                    {
                      name: "r",
                      previousNames: [{ name: 0, project: "old-proj" }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-string DefinitionRepoPreviousName.project", () => {
      expect(
        fails({
          projects: [
            {
              name: "p",
              github: [
                {
                  organization: "org",
                  repos: [
                    {
                      name: "r",
                      previousNames: [{ name: "old", project: false }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ).toBe(true)
    })

    it("rejects non-array project.tags", () => {
      expect(
        fails({ projects: [{ name: "p", github: [], tags: "tag1" }] }),
      ).toBe(true)
    })

    it("rejects non-string items in project.tags", () => {
      expect(
        fails({ projects: [{ name: "p", github: [], tags: [1, 2] }] }),
      ).toBe(true)
    })
  })

  describe("structural validation", () => {
    it("accepts repos array with multiple valid items", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [
                  { name: "repo-a" },
                  { name: "repo-b", archived: false },
                  {
                    name: "repo-c",
                    previousNames: [{ name: "old-c", project: "proj" }],
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("rejects repos array containing non-object items", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [{ organization: "org", repos: ["not-an-object"] }],
          },
        ],
      }
      expect(fails(input)).toBe(true)
    })

    it("accepts multiple github entries per project", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              { organization: "org-a", repos: [{ name: "r1" }] },
              { organization: "org-b" },
            ],
          },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("accepts multiple projects", () => {
      const input = {
        projects: [
          { name: "p1", github: [{ organization: "org-a" }] },
          { name: "p2", github: [{ organization: "org-b" }] },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("accepts empty projects array", () => {
      expect(succeeds({ projects: [] })).toBe(true)
    })

    it("accepts empty github array for a project", () => {
      expect(succeeds({ projects: [{ name: "p", github: [] }] })).toBe(true)
    })
  })

  describe("extra properties", () => {
    it("does not reject extra properties at the top level (strips them)", () => {
      const input = { projects: [], unknownTopLevel: "value" }
      expect(succeeds(input)).toBe(true)
    })

    it("does not reject extra properties on a project (strips them)", () => {
      const input = {
        projects: [{ name: "p", github: [], extraProjectField: 42 }],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("does not reject extra properties on a github entry (strips them)", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [{ organization: "org", extraGithubField: true }],
          },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("does not reject extra properties on a repo (strips them)", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [{ name: "r", extraRepoField: "hello" }],
              },
            ],
          },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })

    it("does not reject extra properties on a previousName entry (strips them)", () => {
      const input = {
        projects: [
          {
            name: "p",
            github: [
              {
                organization: "org",
                repos: [
                  {
                    name: "r",
                    previousNames: [
                      {
                        name: "old",
                        project: "old-proj",
                        extraPrevField: 99,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(succeeds(input)).toBe(true)
    })
  })
})
