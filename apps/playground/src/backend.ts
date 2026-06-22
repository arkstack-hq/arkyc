import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { Arkyc, WebhookSigner } from '@arkyc/sdk'

/** Configuration for the playground backend (all sourced from `.env`). */
export interface ArkycBackendOptions {
  /** Project secret API key (`sk_…`). Stays server-side. */
  secretKey: string
  /** Base URL of the Arkyc API (default `http://localhost:3100`). */
  apiUrl: string
  /** Signing secret of the webhook endpoint pointed at this playground. */
  webhookSecret: string
}

/** A webhook the API delivered to this playground, as shown in the UI. */
interface ReceivedWebhook {
  receivedAt: string
  /** `true`/`false` once verified, or `null` when no signing secret is set. */
  verified: boolean | null
  event: unknown
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/**
 * Vite plugin exposing the playground's own backend under `/pg/*`:
 * `POST /pg/session`, `GET /pg/session/:id`, `GET /pg/webhooks`, and the
 * webhook receiver `POST /pg/webhooks/arkyc`. The secret key is used here
 * (server-side) and never shipped to the browser.
 */
export function arkycBackend(options: ArkycBackendOptions): Plugin {
  const webhooks: ReceivedWebhook[] = []

  // Constructed lazily: `new Arkyc({ secretKey: '' })` throws, and the secret
  // may be absent at config-load (e.g. during `vite build`, or before `.env`).
  let client: Arkyc | null = null
  const sdk = (): Arkyc => (client ??= new Arkyc({ secretKey: options.secretKey, baseUrl: options.apiUrl }))

  return {
    name: 'arkyc-playground-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0] ?? ''
        const method = req.method || 'GET'

        if (!url.startsWith('/pg/')) return next()

        try {
          // Open a session and hand the one-time client token to the frontend.
          if (method === 'POST' && url === '/pg/session') {
            if (!options.secretKey) {
              return sendJson(res, 500, {
                error: 'ARKYC_SECRET_KEY is not set. Copy .env.example to .env and add a project secret key.',
              })
            }
            const raw = await readBody(req)
            const params = (raw ? JSON.parse(raw) : {}) as { userReference?: string }
            const { session, clientToken } = await sdk().sessions.create({
              userReference: params.userReference || `pg_${Date.now()}`,
            })
            return sendJson(res, 200, { clientToken, session })
          }

          // Re-fetch a session server-side to show its decision after the flow.
          if (method === 'GET' && url.startsWith('/pg/session/')) {
            if (!options.secretKey) {
              return sendJson(res, 500, { error: 'ARKYC_SECRET_KEY is not set.' })
            }
            const id = decodeURIComponent(url.slice('/pg/session/'.length))
            const session = await sdk().sessions.retrieve(id)
            return sendJson(res, 200, { session })
          }

          if (method === 'GET' && url === '/pg/webhooks') {
            return sendJson(res, 200, { webhooks })
          }

          // Webhook receiver: verify the signature, then store for the UI.
          if (method === 'POST' && url === '/pg/webhooks/arkyc') {
            const raw = await readBody(req)
            const signature = String(req.headers['x-arkyc-signature'] || '')
            const timestamp = Number(req.headers['x-arkyc-timestamp'] || 0)

            let verified: boolean | null = null
            if (options.webhookSecret && signature && timestamp) {
              verified = WebhookSigner.verify({
                payload: raw,
                secret: options.webhookSecret,
                signature,
                timestamp,
              })
            }

            let event: unknown = raw
            try {
              event = JSON.parse(raw)
            } catch {
              /* keep the raw string if it isn't JSON */
            }

            webhooks.unshift({ receivedAt: new Date().toISOString(), verified, event })
            return sendJson(res, 200, { ok: true })
          }

          return next()
        } catch (err) {
          const status = (err as { status?: number }).status || 500
          sendJson(res, status, { error: (err as Error).message })
        }
      })
    },
  }
}
