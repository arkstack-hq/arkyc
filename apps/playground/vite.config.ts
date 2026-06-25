import { defineConfig, loadEnv } from 'vite'
import { arkycBackend } from './src/backend'

/**
 * Playground dev server.
 *
 * - The UI toggles between two API targets: `local` (the dev API, configured by
 *   ARKYC_API_URL/ARKYC_SECRET_KEY/ARKYC_WEBHOOK_SECRET) and `remote`
 *   (ARKYC_REMOTE_*). The widget's `baseUrl` is `/api/<target>`; each path is
 *   proxied to that target's own `/api/*`, so it stays same-origin (no CORS) and
 *   the secret key never reaches the browser.
 * - `/pg/*` is handled by the {@link arkycBackend} plugin: it uses the server SDK
 *   for the target named in the request's `x-arkyc-target` header.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // The existing ARKYC_* vars configure "local" (back-compat); ARKYC_REMOTE_*
  // configure "remote", defaulting to the hosted API.
  const localApiUrl = (env.ARKYC_API_URL || 'http://localhost:3100').replace(/\/$/, '')
  const remoteApiUrl = (env.ARKYC_REMOTE_API_URL || 'https://api.arkyc.toneflix.net').replace(/\/$/, '')

  const targets = {
    local: {
      apiUrl: localApiUrl,
      secretKey: env.ARKYC_SECRET_KEY || '',
      webhookSecret: env.ARKYC_WEBHOOK_SECRET || '',
    },
    remote: {
      apiUrl: remoteApiUrl,
      secretKey: env.ARKYC_REMOTE_SECRET_KEY || '',
      webhookSecret: env.ARKYC_REMOTE_WEBHOOK_SECRET || '',
    },
  }

  return {
    server: {
      port: Number(env.PORT || 5174),
      proxy: {
        // Strip the `/local` | `/remote` segment so each forwards to the target
        // API's own `/api/*`.
        '/api/local': {
          target: localApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/local/, '/api'),
        },
        '/api/remote': {
          target: remoteApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/remote/, '/api'),
        },
      },
    },
    plugins: [arkycBackend({ targets })],
  }
})
