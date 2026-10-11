/// <reference types="node" />
import { existsSync, readdirSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import { rawCssPlugin } from './packages/widget/raw-css.mjs'

/**
 * Package directories with a manifest. A removed package can leave an ignored
 * `node_modules`/`dist` behind in a reused checkout, which a `packages/*` glob
 * would build as the root package.
 */
const packages = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`packages/${entry.name}/package.json`))
  .map((entry) => `packages/${entry.name}`)

/**
 * Single root tsdown config for the whole workspace (workspace mode).
 *
 * `tsdown` run from the repo root builds every listed package, resolving the
 * shared `entry`/options against each package's own directory. The apps are
 * excluded — `apps/api` is an Arkstack app (builds via `ark build`), and
 * `apps/dashboard` and `apps/playground` are Vite apps (build via `vite build`).
 */
export default defineConfig({
  workspace: packages,
  entry: ['src/{index,browser}.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  treeshake: true,
  unbundle: true,
  define: {
    __ARKYC_API_BASE__: JSON.stringify(process.env.ARKYC_API_URL ?? ''),
  },
  plugins: [rawCssPlugin()],
})
