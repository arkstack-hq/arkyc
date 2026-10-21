# Public Project API

Server-to-server API for creating and managing verification sessions. Call it
from **your backend** with a project **secret key**; never from the browser.

**Base:** `/api/v1` · **Auth:** `Authorization: Bearer sk_…` or `X-Api-Key: sk_…`

The key resolves the organization + project; a key can only touch its own project.

## Endpoints

| Method  | Path                      | Description                                        |
| ------- | ------------------------- | -------------------------------------------------- |
| `GET`   | `/v1/ping/project`        | Health check; confirms the key authenticates.      |
| `POST`  | `/v1/sessions`            | Create a session; returns a one-time client token. |
| `GET`   | `/v1/sessions/:id`        | Retrieve a session's current state.                |
| `POST`  | `/v1/sessions/:id/cancel` | Cancel a non-terminal session.                     |
| `GET`   | `/v1/webhooks`            | List the project's webhook endpoints.              |
| `POST`  | `/v1/webhooks`            | Create an endpoint; returns its secret once.       |
| `GET`   | `/v1/webhooks/:id`        | Retrieve an endpoint.                              |
| `PATCH` | `/v1/webhooks/:id`        | Update an endpoint by id.                          |
| `PATCH` | `/v1/webhooks`            | Update the endpoint whose signing secret matches.  |

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
with it. The token is short-lived (default 15 minutes) and **single-use**: the
widget exchanges it for its own device token on first load, after which it can't
be used again. See [Client API tokens](./client#tokens).

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

## Webhook endpoints

Manage the project's webhook endpoints with the secret key, e.g. to repoint a
development endpoint at a fresh tunnel URL on boot. There is no delete over this
API; remove endpoints in the dashboard.

```http
POST /api/v1/webhooks
Authorization: Bearer sk_live_…
Content-Type: application/json

{ "url": "https://example.com/webhooks/arkyc", "events": ["verification.approved"] }
```

`201` with the endpoint (`id`, `project_id`, `url`, `events`, `status`,
`created_at`) and a top-level `secret` (`whsec_…`). The secret is returned
**only here**; store it to verify deliveries. `url` must be a valid URL and
`events` valid [event names](/integrations/webhooks#events) (else `422`).

```http
PATCH /api/v1/webhooks/:id
Authorization: Bearer sk_live_…

{ "url": "https://new.example.com/webhooks/arkyc" }
```

Updates only the supplied fields (`url`, `events`, `status`: `active` |
`disabled`). The signing secret never changes.

### Update by signing secret

```http
PATCH /api/v1/webhooks
Authorization: Bearer sk_live_…

{ "secret": "whsec_…", "url": "https://new.example.com/webhooks/arkyc" }
```

Finds the endpoint in the key's project whose signing secret is `secret` and
updates it the same way. An integrator that already stores the secret to verify
deliveries then needs no endpoint id. The secret goes in the body, never the URL
(which is logged), and is never echoed back. `404` when no endpoint in the
project has that secret; it never matches another project's endpoint.

::: tip Use the SDK
`@arkyc/sdk` wraps all of this with typed methods and errors; see the
[Server SDK](/integrations/sdk).
:::
