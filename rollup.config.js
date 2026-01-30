import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import replace from "@rollup/plugin-replace"
import typescript from "rollup-plugin-typescript2"
import path from "path"
import pkg from "./package.json" with { type: "json" }

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
    BUILD_TIMESTAMP: JSON.stringify(new Date().toISOString()),
    preventAssignment: true,
  }),
]

export default [
  // ES
  {
    input: "src/index.ts",
    output: {
      file: pkg.main,
      format: "es",
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
      format: "es",
      sourcemap: true,
    },
    external,
    plugins,
  },
]
