import * as path from "path"
import * as tjs from "typescript-json-schema"
import * as fs from "fs"

const program = tjs.getProgramFromFiles(
  [path.resolve("src/definition/types.ts")],
  {
    strictNullChecks: true,
  },
)

const schema = tjs.generateSchema(program, "Definition", {
  required: true,
})

fs.writeFileSync(
  "src/definition-schema.json",
  JSON.stringify(schema, undefined, "  "),
)
