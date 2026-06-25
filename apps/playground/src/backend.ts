import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { Arkyc, WebhookSigner } from '@arkyc/sdk'

/** One switchable API target (local or remote) and its server-side secrets. */
export interface ArkycTargetConfig {
  /** Project secret API key (`sk_…`). Stays server-side. */
  secretKey: string
  /** Base URL of the Arkyc API. */
  apiUrl: string
  /** Signing secret of the webhook endpoint pointed at this playground. */
  webhookSecret: string
}

/** The two targets the UI toggles between. */
export type ArkycTargetName = 'local' | 'remote'

/** Configuration for the playground backend (all sourced from `.env`). */
export interface ArkycBackendOptions {
  targets: Record<ArkycTargetName, ArkycTargetConfig>
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
 * `GET /pg/config`, `POST /pg/session`, `GET /pg/session/:id`, `GET /pg/webhooks`,
 * and the webhook receiver `POST /pg/webhooks/arkyc`. The browser picks which API
 * to act against by sending an `x-arkyc-target: local|remote` header; the secret
 * keys are used here (server-side) and never shipped to the browser.
 */
export function arkycBackend(options: ArkycBackendOptions): Plugin {
  const webhooks: ReceivedWebhook[] = []

  // One SDK client per target, constructed lazily: `new Arkyc({ secretKey: '' })`
  // throws, and a secret may be absent at config-load (during `vite build`, or
  // before `.env`) or for a target the user never configured.
  const clients = new Map<ArkycTargetName, Arkyc>()
  const sdk = (target: ArkycTargetName): Arkyc => {
    let client = clients.get(target)
    if (!client) {
      const cfg = options.targets[target]
      client = new Arkyc({ secretKey: cfg.secretKey, baseUrl: cfg.apiUrl })
      clients.set(target, client)
    }
    return client
  }

  // The browser tells us which target to act against via this header.
  const resolveTarget = (req: IncomingMessage): ArkycTargetName =>
    String(req.headers['x-arkyc-target'] || 'local') === 'remote' ? 'remote' : 'local'

  return {
    name: 'arkyc-playground-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0] ?? ''
        const method = req.method || 'GET'

        if (!url.startsWith('/pg/')) return next()

        const target = resolveTarget(req)
        const secretKeyVar = target === 'remote' ? 'ARKYC_REMOTE_SECRET_KEY' : 'ARKYC_SECRET_KEY'

        try {
          // Which targets are configured, so the UI can label/disable them.
          if (method === 'GET' && url === '/pg/config') {
            return sendJson(res, 200, {
              targets: {
                local: { apiUrl: options.targets.local.apiUrl, configured: !!options.targets.local.secretKey },
                remote: { apiUrl: options.targets.remote.apiUrl, configured: !!options.targets.remote.secretKey },
              },
            })
          }

          // Open a session and hand the one-time client token to the frontend.
          if (method === 'POST' && url === '/pg/session') {
            if (!options.targets[target].secretKey) {
              return sendJson(res, 500, {
                error: `${secretKeyVar} is not set for the "${target}" target. Add it to apps/playground/.env.`,
              })
            }
            const raw = await readBody(req)
            const params = (raw ? JSON.parse(raw) : {}) as { userReference?: string }
            const { session, clientToken } = await sdk(target).sessions.create({
              userReference: params.userReference || `pg_${Date.now()}`,
            })
            return sendJson(res, 200, { clientToken, session })
          }

          // Re-fetch a session server-side to show its decision after the flow.
          if (method === 'GET' && url.startsWith('/pg/session/')) {
            if (!options.targets[target].secretKey) {
              return sendJson(res, 500, { error: `${secretKeyVar} is not set for the "${target}" target.` })
            }
            const id = decodeURIComponent(url.slice('/pg/session/'.length))
            const session = await sdk(target).sessions.retrieve(id)
            return sendJson(res, 200, { session })
          }

          if (method === 'GET' && url === '/pg/webhooks') {
            return sendJson(res, 200, { webhooks })
          }

          // Webhook receiver: verify the signature, then store for the UI. The
          // delivering API can't send our target header, so try every configured
          // signing secret and treat a match as verified.
          if (method === 'POST' && url === '/pg/webhooks/arkyc') {
            const raw = await readBody(req)
            const signature = String(req.headers['x-arkyc-signature'] || '')
            const timestamp = Number(req.headers['x-arkyc-timestamp'] || 0)

            let verified: boolean | null = null
            const secrets = [options.targets.local.webhookSecret, options.targets.remote.webhookSecret].filter(Boolean)
            if (secrets.length && signature && timestamp) {
              verified = secrets.some((secret) => WebhookSigner.verify({ payload: raw, secret, signature, timestamp }))
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
