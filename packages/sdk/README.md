# @arkyc/sdk

TypeScript SDK for [Arkyc](../../README.md) — a typed server client for the
Public Project API, webhook verification, and a browser widget launcher.

## Install

```bash
npm install @arkyc/sdk
```

## Server

```ts
import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({ secretKey: process.env.ARKYC_SECRET_KEY! })

// Open a verification session — returns the session and a one-time client token.
const { session, clientToken } = await arkyc.sessions.create({
  userReference: 'user_123',
  metadata: { plan: 'pro' },
})

await arkyc.sessions.retrieve(session.id)
await arkyc.sessions.cancel(session.id)
```

Non-2xx responses throw a typed `ArkycApiError` (`.status`, `.message`, `.errors`).
Point at a non-default API with `new Arkyc({ secretKey, baseUrl })`.

## Webhook verification

```ts
// In your webhook route, with the raw request body + headers:
const ok = arkyc.webhooks.verify({
  payload: rawBody,
  secret: process.env.ARKYC_WEBHOOK_SECRET!,
  signature: req.headers['x-arkyc-signature'],
  timestamp: Number(req.headers['x-arkyc-timestamp']),
})
if (!ok) return res.status(400).end()
```

## Webhook endpoints

Manage the project's endpoints with the secret key. `create` returns the signing
secret exactly once; updates change only the fields passed, never the secret.
There is no delete (use the dashboard).

```ts
const { endpoint, secret } = await arkyc.webhooks.endpoints.create({
  url: 'https://example.com/webhooks/arkyc',
  events: ['verification.approved', 'verification.rejected'],
})

await arkyc.webhooks.endpoints.list() // { page, perPage } to paginate
await arkyc.webhooks.endpoints.retrieve(endpoint.id)
await arkyc.webhooks.endpoints.update(endpoint.id, { status: 'disabled' })

// No id needed: find the endpoint by the signing secret you already store,
// e.g. to repoint a dev endpoint at a fresh tunnel URL on boot.
await arkyc.webhooks.endpoints.updateBySecret(secret, { url: 'https://new-tunnel.example.com/webhooks/arkyc' })
```

## Browser

```ts
import { ArkycWidget } from '@arkyc/sdk/browser'

// `clientToken` comes from arkyc.sessions.create() on your server.
ArkycWidget.open({
  token: clientToken,
  onComplete: (result) => console.log('done', result.status),
  onError: (err) => console.error(err),
})
```
