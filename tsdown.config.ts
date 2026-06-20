import { defineConfig } from 'tsdown';

/**
 * Single root tsdown config for the whole workspace (workspace mode).
 *
 * `tsdown` run from the repo root builds every listed package, resolving the
 * shared `entry`/options against each package's own directory. `apps/api` is an
 * Arkstack app and builds via `ark build`, so it is intentionally excluded.
 */
export default defineConfig({
  workspace: ['packages/*', 'apps/dashboard', 'apps/playground'],
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  treeshake: true,
  unbundle: true,
});
