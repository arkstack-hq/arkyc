# Architecture

Arkyc is a pnpm monorepo: pure logic lives in `packages/*`, and the apps
(`api`, `dashboard`, `playground`) are thin consumers.

## Monorepo layout

```
apps/
  api/          Arkstack API — public, client/widget, and dashboard surfaces
  dashboard/    React + React Router + Tailwind + alova management UI
  playground/   Example integration (Vite)

packages/
  types/        Shared domain types (the contracts everything conforms to)
  core/         Decision engine, status transitions, scoring (pure)
  auth/         Password / token / API-key / client-token helpers
  permissions/  RBAC: resolve / authorize / sync default roles & permissions
  ocr/          Driver-based OCR (mock | external)
  liveness/     Driver-based passive liveness (mock | external)
  face-match/   Driver-based face matching (mock | external)
  webhooks/     Signing, verification, payload building
  sdk/          @arkyc/sdk — server + browser
  widget/       @arkyc/widget — embeddable verification flow

docs/           This VitePress site
```

## The four API surfaces

All routes are served under a global `/api` prefix.

| Surface             | Prefix          | Auth                        | Used by                   |
| ------------------- | --------------- | --------------------------- | ------------------------- |
| **Auth**            | `/v1/auth`      | none → bearer JWT           | Dashboard sign-in         |
| **Dashboard API**   | `/v1/dashboard` | bearer JWT + permissions    | The management dashboard  |
| **Public Project**  | `/v1/sessions`  | project secret key (`sk_…`) | Your backend / the SDK    |
| **Client / Widget** | `/v1/client`    | short-lived client token    | The widget in the browser |

The secret key never touches the browser: your **backend** creates a session
with the secret key and receives a one-time **client token**, which the
**widget** uses to drive the capture flow. See [the SDK](/integrations/sdk) and
[the widget](/integrations/widget).

## Verification lifecycle

A session walks a state machine enforced by `packages/core`:

```
pending → started → document_submitted → liveness_submitted
        → processing → (approved | requires_review | rejected)
```

plus the terminal states `expired` and `cancelled`.

1. **Create** — your backend calls `POST /v1/sessions`; Arkyc issues a client token.
2. **Capture** — the widget submits the document front/back and a selfie via the Client API.
3. **Analyze** — OCR + portrait extraction, passive liveness, and face match run via [provider drivers](./providers). Heavy work is enqueued to the job queue.
4. **Decide** — the [decision engine](#decision-engine) combines the signals against per-project thresholds and writes `auto_decision`, `final_decision`, `decision_reason`, and `risk_score`.
5. **Review** (optional) — `requires_review` sessions land in the dashboard review queue.
6. **Notify** — each transition emits a signed [webhook](/integrations/webhooks).

## Decision engine

`packages/core` is pure and unit-tested: given OCR confidence, document quality
and expiry, liveness, and face-match scores plus the project's thresholds, it
returns `approved | requires_review | rejected` and a `DecisionReason`. Default
thresholds: document quality `0.75`, OCR confidence `0.8`, liveness `0.85`,
face match `0.75` — overridable per project.

## Async pipeline

Heavy analysis runs off the request path on a durable, Postgres-backed job
queue (`UPDATE … RETURNING` over `FOR UPDATE SKIP LOCKED`). Three queues:

| Queue       | Trigger                     | Work                                                  |
| ----------- | --------------------------- | ----------------------------------------------------- |
| `ocr`       | document front submitted    | run OCR driver + portrait extraction, persist results |
| `biometric` | session enters `processing` | run face match + decision engine, land the verdict    |
| `webhook`   | a transition emits an event | sign + POST the delivery, record the attempt          |

Run workers with `ark queue:work [queue]`. In dev the queue defaults to `sync`
(inline), so no worker is needed.

## Storage

Document and selfie artifacts are written **private** under tenant/project-scoped
keys via Arkstack's `Storage` (flydrive). The `s3` disk is S3-compatible (AWS
S3, MinIO, Cloudflare R2); `gcs`, `local`, and `ftp` round it out. Switching
backends is config + env, no code changes — see [Configuration](./configuration).
