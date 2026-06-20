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
