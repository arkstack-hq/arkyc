import { defineConfig, loadEnv } from 'vite'
import { arkycBackend } from './src/backend'

/**
 * Playground dev server.
 *
 * - `/api/*` is proxied to the real Arkyc API so the in-browser widget (whose
 *   `baseUrl` is `/api`) talks to it same-origin — no CORS, and the secret key
 *   never reaches the browser.
 * - `/pg/*` is handled by the {@link arkycBackend} plugin: it uses the server
 *   SDK (with the secret key) to open/retrieve sessions and to receive webhooks.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = (env.ARKYC_API_URL || 'http://localhost:3100').replace(/\/$/, '')

  return {
    server: {
      port: Number(env.PORT || 5174),
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
      },
    },
    plugins: [
      arkycBackend({
        secretKey: env.ARKYC_SECRET_KEY || '',
        apiUrl,
        webhookSecret: env.ARKYC_WEBHOOK_SECRET || '',
      }),
    ],
  }
})
