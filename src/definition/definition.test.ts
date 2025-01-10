import fs from "node:fs"
import { rm } from "node:fs/promises"
import tempy from "tempy"
import { DefinitionFile, schema } from "./definition"
import { Definition } from "./types"
import { it, expect, describe } from "vitest"

describe("definition", () => {
  it("should error on reading invalid file", async () => {
    const tmp = tempy.file()
    await fs.promises.writeFile(
      tmp,
      JSON.stringify({
        some: "invalid",
      }),
    )

    const definitionFile = new DefinitionFile(tmp)

    await expect(
      definitionFile.getDefinition(),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Definition content invalid: data must have required property 'github', data must have required property 'projects']`,
    )

    await rm(tmp, { force: true })
  })

  it("should successfully parse correct file", async () => {
    const data: Definition = {
      github: {
        teams: [],
        users: [],
      },
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

    const tmp = tempy.file()
    await fs.promises.writeFile(tmp, JSON.stringify(data))

    const definitionFile = new DefinitionFile(tmp)
    await expect(definitionFile.getDefinition()).resolves.toStrictEqual(data)

    await rm(tmp, { force: true })
  })

  it("should match expected schema", () => {
    // Keeping a snapshot of the schema helps us catch
    // unexpected changes.
    expect(schema).toMatchSnapshot()
  })
})
