import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const VIRTUAL_ID = 'virtual:arkyc-theme-css'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * Exposes the widget stylesheet (a lintable `src/theme.css`) to the bundle as a
 * string via `import css from 'virtual:arkyc-theme-css'`. A virtual module (not
 * `./theme.css?raw`) sidesteps the `.css` special-casing in Vite (vitest) and
 * rolldown (tsdown), which otherwise stub the import to empty. Plain `.mjs` so
 * every config loader (vitest, tsdown native) can import it without transpiling.
 */
export function rawCssPlugin() {
  const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), 'src/theme.css')

  return {
    name: 'arkyc-raw-css',
    enforce: 'pre',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      return id === RESOLVED_ID ? `export default ${JSON.stringify(readFileSync(cssPath, 'utf8'))}` : null
    },
  }
}
