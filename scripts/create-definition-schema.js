/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path")
const tjs = require("typescript-json-schema")
const fs = require("fs")

const program = tjs.getProgramFromFiles(
  [path.resolve("src/definition/types.ts")],
  {
    strictNullChecks: true,
  },
)

const schema = tjs.generateSchema(program, "Definition", {
  required: true,
  noExtraProps: true,
})

fs.writeFileSync(
  "definition-schema.json",
  JSON.stringify(schema, undefined, "  "),
)
