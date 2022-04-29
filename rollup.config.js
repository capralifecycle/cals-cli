import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import replace from "@rollup/plugin-replace"
import typescript from "rollup-plugin-typescript2"
import dateFormat from "dateformat"
import path from "path"
import pkg from "./package.json"

const external = [
  "assert",
  "fs",
  "readline",
  "path",
  "https",
  "os",
  "perf_hooks",
  "stream",
  "util",
  ...Object.keys(pkg.dependencies || {}),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      dateFormat(new Date(), "isoDateTime", true),
    ),
    preventAssignment: true,
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
