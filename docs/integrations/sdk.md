# Server SDK

`@arkyc/sdk` is a typed server client for the [Public Project API](/api/public)
plus [webhook](/integrations/webhooks) verification. Use it from your backend
with a project secret key.

## Install

```bash
pnpm add @arkyc/sdk
```

## Construct

```ts
import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({
  secretKey: process.env.ARKYC_SECRET_KEY!, // sk_…
  baseUrl: 'http://localhost:3100', // optional; default https://api.arkyc.toneflix.net
})
```

Requests are sent to `${baseUrl}/api/v1/...`. Pass a custom `fetch` if needed.

## Sessions

```ts
// Open a session and get the one-time client token for the widget.
const { session, clientToken } = await arkyc.sessions.create({
  userReference: 'user_123',
  metadata: { plan: 'pro' },
})

// Fetch current state (poll, or rely on webhooks).
const current = await arkyc.sessions.retrieve(session.id)

// Cancel a non-terminal session.
await arkyc.sessions.cancel(session.id)
```

`create()` returns `{ session, clientToken }`. `retrieve()` / `cancel()` return
the session. The session shape (snake_case) includes `id`, `project_id`,
`status`, `auto_decision`, `final_decision`, `decision_reason`, `risk_score`,
`expires_at`, and `created_at`.

## Typed errors

Failed requests throw `ArkycApiError`:

```ts
import { ArkycApiError } from '@arkyc/sdk'

try {
  await arkyc.sessions.create()
} catch (err) {
  if (err instanceof ArkycApiError) {
    console.error(err.status, err.message, err.errors)
  }
}
```

`status` is the HTTP code; `errors` carries field-level validation errors on a
`422`.

## Webhook verification

```ts
const ok = arkyc.webhooks.verify({
  payload: rawBody, // exact request body string
  secret: process.env.WEBHOOK_SECRET!,
  signature: req.headers['x-arkyc-signature'] as string,
  timestamp: Number(req.headers['x-arkyc-timestamp']),
})
```

`WebhookSigner` (used by `verify`) is also re-exported from `@arkyc/sdk`. See
[Webhooks](/integrations/webhooks).

## Typical flow

```ts
// 1. Backend: open a session
app.post('/verify/start', async (req, res) => {
  const { clientToken } = await arkyc.sessions.create({ userReference: req.user.id })
  res.json({ clientToken }) // send token to the browser
})

// 2. Browser: launch the widget with the token (see Widget docs)
// 3. Backend: receive the webhook, verify it, read the decision
```

## Browser launcher

`@arkyc/sdk/browser` provides a tiny overlay launcher for the **hosted** widget:

```ts
import { ArkycWidget } from '@arkyc/sdk/browser'

ArkycWidget.open({
  token: clientToken,
  onComplete: (result) => console.log(result.status),
})
```

For full control (inline mode, branding, talking to your own API origin), use
the [`@arkyc/widget`](/integrations/widget) package directly.
