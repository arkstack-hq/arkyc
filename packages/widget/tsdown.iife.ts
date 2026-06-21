import { defineConfig } from 'tsdown'

/**
 * Standalone (IIFE/UMD-style) build for the widget. Produces a single minified
 * `dist/arkyc-widget.global.js` that exposes the package on `window.Arkyc`
 * (e.g. `Arkyc.ArkycWidget.open({ token })`) for plain `<script>` embedding and
 * the hosted widget page. The ESM + `.d.ts` build comes from the root tsdown
 * config; this only adds the browser global and does not clean that output.
 */
export default defineConfig({
  entry: { 'arkyc-widget': 'src/index.ts' },
  format: ['iife'],
  globalName: 'Arkyc',
  dts: false,
  clean: false,
  sourcemap: true,
  minify: true,
  target: 'es2020',
  outExtensions: () => ({ js: '.global.js' }),
})
