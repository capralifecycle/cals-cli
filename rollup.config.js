import path from 'path'
import alias from 'rollup-plugin-alias'
import json from 'rollup-plugin-json'
import typescript from 'rollup-plugin-typescript2'
import pkg from './package.json'

const external = [
  'fs',
  'readline',
  'path',
  'https',
  'os',
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const plugins = [
  alias({
    resolve: ['.js', '.json'],
    'package.json': path.resolve('package.json'),
  }),
  typescript(),
  json(),
]

export default [
  // CommonJS
  {
    input: 'src/index.ts',
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    external,
    plugins,
  },
  // ES
  {
    input: 'src/index.ts',
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    external,
    plugins,
  },
  // CLI
  {
    input: 'src/cals-cli.ts',
    output: {
      file: pkg.bin.cals,
      banner: '#!/usr/bin/env node',
      format: 'cjs',
      sourcemap: true,
    },
    external,
    plugins,
  },
]
