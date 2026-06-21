# Client / Widget API

The surface the in-browser widget uses to drive a single session. Authenticated
with the **short-lived client token** from
[`POST /v1/sessions`](./public#create-a-session).

**Base:** `/api/v1/client` · **Auth:** `X-Client-Token: <token>` (or `Authorization: Bearer <token>`)

The token resolves the one session it was minted for; expired tokens are rejected.

::: warning
You normally don't call these endpoints directly — the [widget](/integrations/widget)
does. They're documented for custom flows.
:::

## Endpoints

| Method | Path                        | Description                                                |
| ------ | --------------------------- | ---------------------------------------------------------- |
| `GET`  | `/v1/client/session`        | Fetch the session; marks it `started` on first load.       |
| `POST` | `/v1/client/document/front` | Submit the document front; runs OCR + portrait extraction. |
| `POST` | `/v1/client/document/back`  | Submit the document back (skipped for single-sided docs).  |
| `POST` | `/v1/client/liveness`       | Submit the selfie / passive liveness frame.                |
| `POST` | `/v1/client/complete`       | Finalize — run the decision engine and land the verdict.   |

## Uploads

Document and liveness endpoints accept `multipart/form-data` with the image
file. With `mock` providers you may include hint fields to script the outcome
(e.g. `confidence`, `expired`, `score`, `passed`, `similarityScore`) — see
[Provider drivers](/guide/providers#mock-hint-signals).

```http
POST /api/v1/client/document/front
X-Client-Token: <token>
Content-Type: multipart/form-data

image=@front.jpg
```

## Completing

```http
POST /api/v1/client/complete
X-Client-Token: <token>
```

Enqueues the biometric + decision work (or runs inline with the `sync` queue).
The session moves to `processing`, then to `approved` / `requires_review` /
`rejected`. Read the result via the
[Public API](./public#retrieve-a-session) or a [webhook](/integrations/webhooks).

## Limits

- Sessions expire (default 15 minutes); expired sessions reject further calls.
- Liveness is capped at 3 attempts per session.
