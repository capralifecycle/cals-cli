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

const plugins = [typescript()]

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
