/// <reference types="node" />
import { defineConfig } from 'tsdown'
import { rawCssPlugin } from './raw-css.mjs'

/**
 * Standalone (IIFE/UMD-style) build for the widget. Produces a single minified
 * `dist/arkyc-widget.iife.global.js` for plain `<script>` embedding (and the
 * hosted widget page), served from jsDelivr.
 *
 * The bundle attaches to `window.Arkyc`, and the `footer` also lifts the launcher
 * straight onto `window` so embedders can call `ArkycWidget.open({ token })` with
 * no namespace — no scoped instance needed. The ESM + `.d.ts` build comes from the
 * root tsdown config; this only adds the browser global and does not clean it.
 */
export default defineConfig({
  entry: { 'arkyc-widget': 'src/index.ts' },
  format: ['iife'],
  globalName: 'Arkyc',
  noExternal: [/^@arkyc\//, 'qrcode-generator'],
  footer: 'var ArkycWidget=Arkyc.ArkycWidget;var ArkycClient=Arkyc.ArkycClient;',
  dts: false,
  clean: false,
  sourcemap: true,
  minify: true,
  target: 'es2020',
  outExtensions: () => ({ js: '.global.js' }),
  define: {
    __ARKYC_API_BASE__: JSON.stringify(process.env.ARKYC_API_URL ?? '')
  },
  plugins: [rawCssPlugin()],
})
