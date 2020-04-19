import dateFormat from "dateformat"
import path from "path"
import alias from "rollup-plugin-alias"
import json from "rollup-plugin-json"
import replace from "rollup-plugin-replace"
import typescript from "rollup-plugin-typescript2"
import pkg from "./package.json"

const external = [
  "fs",
  "readline",
  "path",
  "https",
  "os",
  "util",
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const plugins = [
  alias({
    resolve: [".js", ".json"],
    entries: [
      {
        find: "package.json",
        replacement: path.resolve("package.json"),
      },
    ],
  }),
  typescript(),
  json(),
  replace({
    BUILD_TIMESTAMP: JSON.stringify(
      dateFormat(new Date(), "isoDateTime", true),
    ),
  }),
]

export default [
  // CommonJS
  {
    input: "src/index.ts",
    output: {
      file: pkg.main,
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins,
  },
  // ES
  {
    input: "src/index.ts",
    output: {
      file: pkg.module,
      format: "es",
      sourcemap: true,
    },
    external,
    plugins,
  },
  // CLI
  {
    input: "src/cals-cli.ts",
    output: {
      file: pkg.bin.cals,
      banner: "#!/usr/bin/env node",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins,
  },
]
