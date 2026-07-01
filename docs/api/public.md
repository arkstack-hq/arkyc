# Public Project API

Server-to-server API for creating and managing verification sessions. Call it
from **your backend** with a project **secret key**; never from the browser.

**Base:** `/api/v1` · **Auth:** `Authorization: Bearer sk_…` or `X-Api-Key: sk_…`

The key resolves the tenant + project; a key can only touch its own project.

## Endpoints

| Method | Path                      | Description                                        |
| ------ | ------------------------- | -------------------------------------------------- |
| `GET`  | `/v1/ping/project`        | Health check; confirms the key authenticates.      |
| `POST` | `/v1/sessions`            | Create a session; returns a one-time client token. |
| `GET`  | `/v1/sessions/:id`        | Retrieve a session's current state.                |
| `POST` | `/v1/sessions/:id/cancel` | Cancel a non-terminal session.                     |

## Create a session

```http
POST /api/v1/sessions
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "user_reference": "user_123",
  "metadata": { "plan": "pro" }
}
```

Both fields are optional. Response (`201`):

```json
{
  "status": "success",
  "message": "Verification session created",
  "code": 201,
  "client_token": "…",
  "data": {
    "id": "…",
    "project_id": "…",
    "user_reference": "user_123",
    "status": "pending",
    "auto_decision": null,
    "final_decision": null,
    "decision_reason": null,
    "risk_score": null,
    "expires_at": "2026-06-21T20:15:00Z",
    "created_at": "2026-06-21T20:00:00Z"
  }
}
```

Hand `client_token` to the browser and launch the [widget](/integrations/widget)
with it. The token is short-lived (default 15 minutes).

## Retrieve a session

```http
GET /api/v1/sessions/:id
Authorization: Bearer sk_live_…
```

Returns the session in `data`; poll this (or rely on
[webhooks](/integrations/webhooks)) to learn the final decision.

## Cancel a session

```http
POST /api/v1/sessions/:id/cancel
Authorization: Bearer sk_live_…
```

Moves a non-terminal session to `cancelled`.

::: tip Use the SDK
`@arkyc/sdk` wraps all of this with typed methods and errors; see the
[Server SDK](/integrations/sdk).
:::
