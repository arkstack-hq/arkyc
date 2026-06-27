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
  // A `<script>`/CDN bundle must be self-contained — inline the workspace + npm
  // deps that the ESM build would otherwise leave external (else the global
  // references undefined `_arkyc_types` / `qrcode_generator` at runtime).
  noExternal: [/^@arkyc\//, 'qrcode-generator'],
  // Lift the launcher (and API client) directly onto `window`, so a `<script>`
  // embed uses `ArkycWidget.open(...)` rather than `Arkyc.ArkycWidget.open(...)`.
  footer: 'var ArkycWidget=Arkyc.ArkycWidget;var ArkycClient=Arkyc.ArkycClient;',
  dts: false,
  clean: false,
  sourcemap: true,
  minify: true,
  target: 'es2020',
  outExtensions: () => ({ js: '.global.js' }),
  // Bake the widget's default Client API base from env at build time (see client.ts).
  define: { __ARKYC_API_BASE__: JSON.stringify(process.env.ARKYC_API_URL ?? '') },
  // Inline the widget's lintable `theme.css` as a string (`virtual:arkyc-theme-css`).
  plugins: [rawCssPlugin()],
})
