import assert from "node:assert/strict"
import { promises as fsPromises } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { DefinitionFile, parseDefinition } from "./definition"
import type { Definition } from "./types"
import { definitionSchema } from "./types"

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

    await assert.rejects(
      definitionFile.getDefinition(),
      /Definition content invalid/,
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
    assert.deepEqual(await definitionFile.getDefinition(), data)

    await rm(tmpFile, { force: true })
  })

  it("should reject when projects is missing", () => {
    assert.throws(() => parseDefinition("{}"), /Definition content invalid/)
  })

  it("should reject when project name is missing", () => {
    assert.throws(
      () => parseDefinition(JSON.stringify({ projects: [{ github: [] }] })),
      /Definition content invalid/,
    )
  })

  it("should reject when github organization is missing", () => {
    assert.throws(
      () =>
        parseDefinition(
          JSON.stringify({
            projects: [{ name: "p", github: [{ repos: [] }] }],
          }),
        ),
      /Definition content invalid/,
    )
  })

  it("should reject duplicate project names", () => {
    assert.throws(
      () =>
        parseDefinition(
          JSON.stringify({
            projects: [
              { name: "dup", github: [] },
              { name: "dup", github: [] },
            ],
          }),
        ),
      /Duplicate project: dup/,
    )
  })

  it("should reject duplicate repos", () => {
    assert.throws(
      () =>
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
      /Duplicate repo: org\/repo/,
    )
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

    assert.deepEqual(parseDefinition(JSON.stringify(data)), data)
  })

  it("should reject wrong types", () => {
    assert.throws(
      () =>
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
      /Definition content invalid/,
    )
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
      assert.ok(fails({}))
      assert.ok(succeeds(validDefinition))
    })

    it("requires project.name", () => {
      const input = { projects: [{ github: [validGithubEntry] }] }
      assert.ok(fails(input))
    })

    it("requires project.github", () => {
      const input = { projects: [{ name: "p" }] }
      assert.ok(fails(input))
    })

    it("requires github[].organization", () => {
      const input = { projects: [{ name: "p", github: [{ repos: [] }] }] }
      assert.ok(fails(input))
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
      assert.ok(fails(input))
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
      assert.ok(fails(input))
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
      assert.ok(fails(input))
    })
  })

  describe("optional fields", () => {
    it("project.tags is optional", () => {
      const withoutTags = { projects: [{ name: "p", github: [] }] }
      const withTags = {
        projects: [{ name: "p", github: [], tags: ["a", "b"] }],
      }
      assert.ok(succeeds(withoutTags))
      assert.ok(succeeds(withTags))
    })

    it("github[].repos is optional", () => {
      const withoutRepos = {
        projects: [{ name: "p", github: [{ organization: "org" }] }],
      }
      const withRepos = {
        projects: [{ name: "p", github: [{ organization: "org", repos: [] }] }],
      }
      assert.ok(succeeds(withoutRepos))
      assert.ok(succeeds(withRepos))
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
      assert.ok(succeeds(withoutArchived))
      assert.ok(succeeds(withArchived))
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
      assert.ok(succeeds(withoutPreviousNames))
      assert.ok(succeeds(withPreviousNames))
    })
  })

  describe("type enforcement", () => {
    it("rejects non-array projects", () => {
      assert.ok(fails({ projects: "not-an-array" }))
      assert.ok(fails({ projects: 42 }))
      assert.ok(fails({ projects: {} }))
    })

    it("rejects non-string project.name", () => {
      assert.ok(fails({ projects: [{ name: 123, github: [] }] }))
      assert.ok(fails({ projects: [{ name: true, github: [] }] }))
      assert.ok(fails({ projects: [{ name: [], github: [] }] }))
    })

    it("rejects non-array project.github", () => {
      assert.ok(fails({ projects: [{ name: "p", github: "org" }] }))
      assert.ok(fails({ projects: [{ name: "p", github: 1 }] }))
    })

    it("rejects non-string github[].organization", () => {
      assert.ok(
        fails({ projects: [{ name: "p", github: [{ organization: 99 }] }] }),
      )
      assert.ok(
        fails({
          projects: [{ name: "p", github: [{ organization: false }] }],
        }),
      )
    })

    it("rejects non-array github[].repos", () => {
      assert.ok(
        fails({
          projects: [
            { name: "p", github: [{ organization: "org", repos: "bad" }] },
          ],
        }),
      )
    })

    it("rejects non-string DefinitionRepo.name", () => {
      assert.ok(
        fails({
          projects: [
            {
              name: "p",
              github: [{ organization: "org", repos: [{ name: 42 }] }],
            },
          ],
        }),
      )
    })

    it("rejects non-boolean DefinitionRepo.archived", () => {
      assert.ok(
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
      )
      assert.ok(
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
      )
    })

    it("rejects non-array DefinitionRepo.previousNames", () => {
      assert.ok(
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
      )
    })

    it("rejects non-string DefinitionRepoPreviousName.name", () => {
      assert.ok(
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
      )
    })

    it("rejects non-string DefinitionRepoPreviousName.project", () => {
      assert.ok(
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
      )
    })

    it("rejects non-array project.tags", () => {
      assert.ok(fails({ projects: [{ name: "p", github: [], tags: "tag1" }] }))
    })

    it("rejects non-string items in project.tags", () => {
      assert.ok(fails({ projects: [{ name: "p", github: [], tags: [1, 2] }] }))
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
      assert.ok(succeeds(input))
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
      assert.ok(fails(input))
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
      assert.ok(succeeds(input))
    })

    it("accepts multiple projects", () => {
      const input = {
        projects: [
          { name: "p1", github: [{ organization: "org-a" }] },
          { name: "p2", github: [{ organization: "org-b" }] },
        ],
      }
      assert.ok(succeeds(input))
    })

    it("accepts empty projects array", () => {
      assert.ok(succeeds({ projects: [] }))
    })

    it("accepts empty github array for a project", () => {
      assert.ok(succeeds({ projects: [{ name: "p", github: [] }] }))
    })
  })

  describe("extra properties", () => {
    it("does not reject extra properties at the top level (strips them)", () => {
      const input = { projects: [], unknownTopLevel: "value" }
      assert.ok(succeeds(input))
    })

    it("does not reject extra properties on a project (strips them)", () => {
      const input = {
        projects: [{ name: "p", github: [], extraProjectField: 42 }],
      }
      assert.ok(succeeds(input))
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
      assert.ok(succeeds(input))
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
      assert.ok(succeeds(input))
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
      assert.ok(succeeds(input))
    })
  })
})
