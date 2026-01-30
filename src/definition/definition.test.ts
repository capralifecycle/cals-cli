import { promises as fsPromises } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DefinitionFile, schema } from "./definition"
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

    await expect(
      definitionFile.getDefinition(),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Definition content invalid: data must have required property 'projects']`,
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

  it("should match expected schema", () => {
    // Keeping a snapshot of the schema helps us catch
    // unexpected changes.
    expect(schema).toMatchSnapshot()
  })
})
