import del from "del"
import fs from "fs"
import tempy from "tempy"
import { DefinitionFile, schema } from "./definition"
import { Definition } from "./types"

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
      `"Definition file invalid: data should have required property 'github', data should have required property 'projects'"`,
    )

    await del(tmp, { force: true })
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

    await del(tmp, { force: true })
  })

  it("should match expected schema", () => {
    // Keeping a snapshot of the schema helps us catch
    // unexpected changes.
    expect(schema).toMatchSnapshot()
  })
})
