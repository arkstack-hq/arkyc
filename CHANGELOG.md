# Changelog

All notable changes to Arkyc are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-10-21

### Fixed

- **OCR falls back instead of stalling the decision.** When the primary driver
  fails (e.g. a misconfigured AI provider answering 404) or reads no identity
  field, `OcrJob` now uses `OCR_FALLBACK_DRIVER`, keeping the primary's
  authenticity read and raw payload. Previously the job failed and the decision
  waited on "OCR result is not ready yet" until the session expired.
- **AI OCR keeps what the model read.** Field aliases (`surname`, `first_name`,
  `nin`, `dob`, …) and a nested `fields` object are mapped, numeric values are
  accepted, and the model's tool arguments are stored as `raw.modelOutput`.
- **`BiometricJob` is idempotent across retries.** A retried job reuses the
  recorded face match instead of re-running the model and inserting a duplicate
  check. Each step (face match, every risk detector, decision) now logs its timing,
  so a job killed or stuck mid-run can be pinned to its last unfinished step.
- **OCR debug logging** (`storage/logs/ocr.log`) checked `app.name` instead of
  `app.env`, so it never wrote; it now logs in `local`/`development`.
- **The PM2 queue worker never processed a job.** PM2 ran `script` under node:
  - With `node_modules/.bin/ark` (a pnpm shell-script shim), node parsed shell as
    JS and the worker crash-looped (`SyntaxError: missing ) after argument list`).
  - With the CLI's JS entry, PM2 loads it from its `ProcessContainerFork`, so the
    CLI's entry-point check (`process.argv[1]` is this file) fails and the worker
    sits "online" doing nothing, printing nothing.

  Either way no OCR, decisioning or webhook job ran: sessions stalled in
  `processing` and deliveries stayed `pending`. The worker now executes the shim
  directly (`interpreter: 'none'`), so the CLI runs as the real entry point.
  Recreate the process to apply it (a reload keeps the old `script`):
  `pm2 delete arkyc-worker && pm2 start ecosystem.config.cjs --only arkyc-worker`.

## [2.1.0] - 2026-10-21

### Added

- **Webhook endpoints over the Public API.** With the project's secret key:
  `GET /v1/webhooks`, `POST /v1/webhooks` (returns the signing secret once),
  `GET /v1/webhooks/:id`, `PATCH /v1/webhooks/:id`, and `PATCH /v1/webhooks` to
  update the endpoint **by its signing secret** (sent in the body), so an
  integrator storing the secret needs no endpoint id. No delete over this API.
  `@arkyc/sdk` exposes them on `arkyc.webhooks.endpoints` (`list`, `retrieve`,
  `create`, `update`, `updateBySecret`).
- **Configurable job queues.** Each job's queue now comes from config
  (`queue.queues.*`), overridable via `QUEUE_NAME_OCR`, `QUEUE_NAME_BIOMETRIC`,
  `QUEUE_NAME_WEBHOOK`, `QUEUE_NAME_MAINTENANCE` and `QUEUE_NAME_NOTIFICATIONS`.
  Defaults are unchanged.

### Fixed

- **Stalled sessions and undelivered webhooks under PM2.** The bundled
  `ecosystem.config.cjs` runs one `ark queue:work`, which only drains the `default`
  queue, while every job is dispatched to a named queue. OCR, decisioning and webhook
  jobs were never processed: sessions stalled in `processing` until they expired,
  and no webhook (not even a dashboard test event) was delivered. The worker now
  runs `queue:work --queue=webhook,*`: every queue, webhook deliveries first.

### Changed

- **Webhook endpoint URLs are validated** as URLs on create and update, in the
  dashboard API too (previously any string was accepted and failed only at
  delivery).
- **`@arkstack/*` 0.19.6.** Brings `queue:work` priority lists
  (`--queue=webhook,ocr`) and the `*` wildcard for every queue.
- **Queue worker docs.** `ark queue:work webhook` named the connection rather than
  the queue. The self-hosting guide now covers one worker per queue and a single
  `--queue=webhook,*` worker, across all five queues.

## [2.0.0] - 2026-10-11

Fraud signals and compliance screening, self-hostable biometrics, realtime on
Arkstack with in-app notifications, single-use client tokens, and a production
hardening pass.

### Changed (breaking)

- **Client tokens are single-use.** The `client_token` from `POST /v1/sessions` is
  now a launch token. It can only be exchanged once, at `POST /v1/client/claim`,
  for a device token bound to the claiming origin; a second claim returns `409`
  `client_token_used`. Every other Client API call needs the device token. The
  widget and SDK do this for you; direct Client API integrations must claim first.
- **`@arkyc/realtime` is removed.** Realtime now runs on `@arkstack/notifications`
  (API) and `@arkstack/realtime` (dashboard and widget). The platform
  `realtime.transport` setting is gone; the transport comes from
  `REALTIME_TRANSPORT` (`pusher`, `firebase`, `firebase-database`, `polling`,
  `memory`), which now defaults to `polling`.
- **Realtime channel names use dots:** `private-session.<id>`,
  `private-organization.<id>`, `private-organization.<id>.project.<id>`, plus the
  new `private-user.<id>`.
- **Pusher env keys renamed:** `PUSHER_APP_KEY` to `PUSHER_KEY`,
  `PUSHER_APP_SECRET` to `PUSHER_SECRET`.
- **Postgres needs the `pgvector` extension.** `ark migrate` enables it for face
  embeddings and fails without it. Docker Compose and CI now use
  `pgvector/pgvector:pg16`.
- **Workflows list a new `screening` stage.** Stored and returned workflows include
  it (disabled unless turned on), so code that expects exactly four stages needs
  updating.
- `.env.example` is reorganized by section; every variable is documented in the
  configuration guide.

### Added

#### Fraud signals and compliance screening

- **Risk signals** feed the decision engine: duplicate documents, duplicate
  identities, duplicate faces, document tampering, inconsistent documents (MRZ
  check digits, MRZ against the visual zone, impossible dates), underage holders,
  risky networks (VPN, Tor, proxy, hosting), IP country mismatch and session
  velocity. Signals are stored per session (`session_risk_signals`).
- New decision reasons: `DUPLICATE_DOCUMENT`, `DUPLICATE_IDENTITY`,
  `DUPLICATE_FACE`, `DOCUMENT_TAMPERING`, `SANCTIONS_MATCH`, `PEP_MATCH`,
  `ADVERSE_MEDIA_MATCH`, `HIGH_RISK_DEVICE`, `VELOCITY_EXCEEDED`, `UNDERAGE`.
- Signals send sessions to review by default. Each workflow can set any signal to
  ignore, review or reject (`options.risk_policy`), or pick a preset in the
  dashboard (Balanced, Strict, Relaxed).
- Duplicate matching uses keyed hashes derived from `APP_KEY`; raw document
  numbers are never stored or compared. Pass a stable `user_reference` per end
  user to enable it.
- **Duplicate face detection**, opt-in per organization: selfie embeddings stored
  with pgvector, with their own retention.
- **Watchlist screening stage** with a match threshold and `on_hit` of review or
  reject. New `@arkyc/screening` package with `mock`, `opensanctions` (hosted API
  or self-hosted yente) and `external` drivers.
- **Ongoing monitoring** re-screens completed identities on a schedule
  (`SCREENING_MONITOR_INTERVAL_HOURS`, `ark screening:monitor`) and sends a new
  `verification.screening_alert` webhook on new hits.
- Reviewers see each hit next to the extracted identity and can clear a false
  positive with an audited reason
  (`PATCH /sessions/:id/risk-signals/:signalId/clear`).
- New `@arkyc/network` package with a `maxmind` driver (GeoLite2 Country and ASN,
  optional GeoIP2 Anonymous IP and a Tor exit list).
- Per-project velocity limits; a minimum age per workflow (`options.min_age`).
- The claim records the client IP and user agent.

#### Self-hostable biometrics

- New `local` face-match and liveness drivers run open models on ONNX Runtime in
  the worker, with no external provider: YuNet (MIT), SFace (Apache-2.0),
  MiniFASNetV2 (Apache-2.0).
- `ark biometrics:setup` downloads and checksum-verifies the models;
  `ark biometrics:benchmark pairs.csv` reports accuracy and latency.
- New `@arkyc/vision` package (face detection, alignment, model store);
  face-match drivers gain an optional `embed()`.

#### Notifications and realtime

- In-app notifications with a live bell and browser push (FCM) for: a session
  needing review, a review assigned to you, a review decided by someone else, a
  webhook exhausting its retries, an invitation, and screening hits.
- `/v1/account` endpoints for notifications, preferences and push tokens; users
  with a verified email can accept invitations in the dashboard.
- Widget live updates over `@arkstack/realtime`, loading transport SDKs from
  jsDelivr for plain script embeds and falling back to polling.

#### Integrations

- Webhooks carry `checks.risk` (score and signals) and `checks.screening`
  (uncleared hits).
- SDK: `arkyc.webhooks.constructEvent()` verifies and parses a webhook;
  `WebhookEvent`, `WebhookChecks`, `WebhookRiskCheck`, `ScreeningHit` and
  `DecisionReason` are exported.
- Widget events are strongly typed, and `complete` fires immediately for a session
  already decided on load.
- Cross-device handoff uses its own single-use handoff token
  (`POST /v1/client/handoff`).
- The OCR `ai` driver can run on Cloudflare Workers AI (`WORKERS_AI_MODEL`,
  `OCR_AI_PROVIDER=workers-ai`).

#### Dashboard

- Workflow editor is now a full page: pipeline preview, stage switches, inline
  stage settings, document options and fraud signal presets.
- Verification thresholds show the value in effect with its default and a reset;
  the address threshold is now editable.
- Project velocity settings and an organization face-embedding opt-in.

#### Operations

- **Session-expiry sweep** that expires past-TTL, non-terminal sessions and fires
  `verification.expired` webhooks and realtime. Drivers via `SESSION_SWEEP_DRIVER`:
  `schedule` (framework scheduler, default), `queue` (a self-rescheduling job with
  no cron, started with `ark session:sweep --loop`) or `off`.
- **Per-organization media retention**: deletes captured images, selfie, liveness
  video and proof-of-address once a session is older than the organization's
  `retention_days`, keeping the session row and decision. Runs on the scheduler or
  the queue sweep, or with `ark retention:purge`. Face embeddings expire on their
  own retention.
- **Observability hooks**: a vendor-neutral `reportError` in the global error path
  and maintenance jobs, plus a no-op metrics sink to swap for a backend.
- Hot-path indexes on `verification_sessions`.
- Dockerfile for the API and queue workers; Compose profiles `app`, `worker` and
  `realtime` (soketi). MinIO and R2 were removed in favour of the generic `s3`
  disk.
- `TRUST_PROXY` setting so the API sees real client IPs behind a load balancer.

### Security

- Rate limits on auth (login, 2FA, register, forgot password, email verification),
  the API-key session routes and webhook test deliveries.
- Webhook signing secrets are encrypted at rest with `APP_KEY` (AES-GCM) and
  decrypted only at sign time.
- Per-project origin allowlist on client requests (`403` `origin_not_allowed`);
  an empty list never blocks.
- Audited retry limits (webhook 5, OCR 3, biometric 5, liveness attempts 3) and
  signed asset URL lifetimes; all are bounded.

### Upgrading

1. Make sure Postgres has the `pgvector` extension available, then run
   `ark migrate`.
2. Set a strong, stable `APP_KEY`. It encrypts webhook secrets and keys document
   fingerprints; rotating it breaks both.
3. Rename `PUSHER_APP_KEY` / `PUSHER_APP_SECRET` to `PUSHER_KEY` /
   `PUSHER_SECRET` and set `REALTIME_TRANSPORT`.
4. If you call the Client API directly, claim the launch token at
   `POST /v1/client/claim` and use the returned device token.
5. Behind a proxy or load balancer, set `TRUST_PROXY` (for example `1`).
6. Optional: set `SCREENING_DRIVER`, `NETWORK_DRIVER`, or
   `FACE_MATCH_DRIVER=local` / `LIVENESS_DRIVER=local` and run
   `ark biometrics:setup`.

OpenSanctions data is free for non-commercial use; commercial screening needs a
licence from OpenSanctions.
