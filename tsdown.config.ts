import { defineConfig } from 'tsdown'

/**
 * Single root tsdown config for the whole workspace (workspace mode).
 *
 * `tsdown` run from the repo root builds every listed package, resolving the
 * shared `entry`/options against each package's own directory. `apps/api` is an
 * Arkstack app (builds via `ark build`) and `apps/dashboard` is a Vite React app
 * (builds via `vite build`), so both are intentionally excluded.
 */
export default defineConfig({
  workspace: ['packages/*', 'apps/playground'],
  // Glob so packages exposing extra entrypoints (e.g. @arkyc/sdk's `browser`)
  // build them too; matches only files that exist per package.
  entry: ['src/{index,browser}.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  treeshake: true,
  unbundle: true,
})
