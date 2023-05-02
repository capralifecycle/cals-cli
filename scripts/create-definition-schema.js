/* eslint-disable @typescript-eslint/no-var-requires */
import path from "node:path";
import tjs from "typescript-json-schema";
import fs from "node:fs";
const program = tjs.getProgramFromFiles([path.resolve("src/definition/types.ts")], {
    strictNullChecks: true,
});
const schema = tjs.generateSchema(program, "Definition", {
    required: true,
});
fs.writeFileSync("src/definition-schema.json", JSON.stringify(schema, undefined, "  "));
