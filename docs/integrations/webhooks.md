# Webhooks

Arkyc delivers signed, per-project webhooks for verification events, with
retries and a delivery log.

## Configure an endpoint

In the dashboard: **Project → Webhooks → add endpoint**. Provide a URL and the
events to subscribe to. The **signing secret** is shown once — store it. You can
also send a test delivery, or use the
[Dashboard API](/api/dashboard#webhooks).

## Events

```
verification.started
verification.document_submitted
verification.processing
verification.requires_review
verification.approved
verification.rejected
verification.completed
verification.expired
verification.cancelled
```

Events fire from a single transition choke point, covering the session service,
the biometric worker, and review actions.

## Payload

```json
{
  "event": "verification.approved",
  "session_id": "…",
  "tenant_id": "…",
  "project_id": "…",
  "user_reference": "user_123",
  "status": "approved",
  "checks": {
    "document": { "quality_score": 0.93, "ocr_confidence": 0.88, "expired": false },
    "liveness": { "passed": true, "score": 0.97 },
    "face_match": { "passed": true, "similarity_score": 0.91 }
  },
  "decision_reason": null,
  "created_at": "2026-06-21T20:05:00Z"
}
```

## Signature

Each delivery is a `POST` with:

| Header               | Value                                            |
| -------------------- | ------------------------------------------------ |
| `Content-Type`       | `application/json`                               |
| `X-Arkyc-Signature`  | HMAC-SHA256 of `${timestamp}.${rawBody}`         |
| `X-Arkyc-Timestamp`  | Unix seconds when the delivery was signed        |

Verify with the SDK (constant-time compare + timestamp tolerance):

```ts
import { WebhookSigner } from '@arkyc/sdk'

const ok = WebhookSigner.verify({
  payload: rawBody,                                  // the exact bytes received
  secret: process.env.ARKYC_WEBHOOK_SECRET!,
  signature: req.headers['x-arkyc-signature'] as string,
  timestamp: Number(req.headers['x-arkyc-timestamp']),
  toleranceSec: 300,                                 // optional, default 300
})
if (!ok) return res.status(400).end()
```

Read the **raw** request body — verifying a re-serialized JSON object will fail.

## Express receiver example

```ts
import express from 'express'
import { WebhookSigner } from '@arkyc/sdk'

const app = express()

app.post('/webhooks/arkyc', express.raw({ type: 'application/json' }), (req, res) => {
  const raw = req.body.toString('utf8')
  const ok = WebhookSigner.verify({
    payload: raw,
    secret: process.env.ARKYC_WEBHOOK_SECRET!,
    signature: req.get('x-arkyc-signature')!,
    timestamp: Number(req.get('x-arkyc-timestamp')),
  })
  if (!ok) return res.status(400).end()

  const event = JSON.parse(raw)
  // …handle event.event / event.status…
  res.json({ ok: true })
})
```

## Delivery & retries

A queue-backed worker signs and POSTs each delivery, recording `webhook_deliveries`
(attempts, response status/body). Failures retry with backoff and dead-letter
after the max attempts. Run the worker with `ark queue:work webhook` (see
[Self-hosting](/guide/self-hosting#queue-workers)).

> The signing secret is stored as-is to re-sign deliveries; encryption-at-rest is
> a planned hardening item.
