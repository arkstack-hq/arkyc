/// <reference types="node" />
import { defineConfig } from 'tsdown'
import { rawCssPlugin } from './packages/widget/raw-css.mjs'

/**
 * Single root tsdown config for the whole workspace (workspace mode).
 *
 * `tsdown` run from the repo root builds every listed package, resolving the
 * shared `entry`/options against each package's own directory. The apps are
 * excluded — `apps/api` is an Arkstack app (builds via `ark build`), and
 * `apps/dashboard` and `apps/playground` are Vite apps (build via `vite build`).
 */
export default defineConfig({
  workspace: ['packages/*'],
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
