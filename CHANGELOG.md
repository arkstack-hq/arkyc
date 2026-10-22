# Changelog

All notable changes to Arkyc are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.1] - 2026-10-22

### Changed

- **Deletion shows its progress.** A deleted project or organization is marked as queued for deletion (`deletion_requested_at`) until the background job removes it. The dashboard shows a "Deleting" badge and disables the delete button meanwhile, and a repeat request returns `409`. Stored files are now removed by folder, so the job finishes faster.

### Fixed

- The dashboard failed to load `pusher-js` for realtime because the SDK wasn't bundled.
- The admin area could crash with React error #310 after loading.

## [2.5.0] - 2026-10-22

### Added

- **Business verification.** Every organization proves it is a business that may handle personal data before verifying identities in production: legal and registration details, a data protection officer, a privacy policy and a certificate of incorporation. Platform admins review submissions in a new queue, approve or reject with a note, and can mark an organization verified directly. Managers are notified of the decision.
- **Delete projects and organizations** from their settings pages, confirmed by typing the exact name. Everything in them goes too: sessions, captured media, API keys, webhooks, members and audit logs. Organization deletions are kept in the platform audit log.
- **Sidebar counters** for things waiting on you: sessions awaiting review, your pending invitations, an organization that still needs verifying, and, for platform admins, pending extended access requests and business verifications.
- **Admin organization page** shows verification, session outcomes, approval rate, a 30-day trend, top risk signals and usage. A new **admin project page** shows one project's configuration, thresholds, access, outcomes and recent sessions.
- A **Documentation** link in the dashboard sidebar (`VITE_WEBSITE_URL`).

### Changed

- **Production needs a verified business.** Unverified organizations can't create production projects (new projects default to `development`), and live sessions on their existing production projects return `403` `organization_unverified`. Development and staging are unaffected. Platform admins can switch the gate off under Admin → Settings → Compliance.
- New projects start with Arkyc's primary color.
- Extended access greys out capabilities already granted or awaiting review, and hides the request form once nothing is left to request.
- The workflow address auto-verify hint shows the accepted range and the project default.

### Fixed

- **Reviewers can see the uploaded proof of address.** It is now session media
  (`proof_of_address`) on the review page and a signed asset on the session.

### Upgrading

- Before deploying to an instance with production projects, verify those organizations (or mark them verified from the admin organization page), or switch the compliance gate off, otherwise their live sessions are refused.
- Run `ark migrate` for the verification columns and table.

## [2.4.0] - 2026-10-21

### Added

- **Liveness reject floor** (`livenessRejectThreshold`, per project, default
  `0.2`, dashboard Settings → Verification thresholds). A failed liveness check
  is declined only when it scores below the floor (a clear spoof); a failed check
  scoring from the floor up is borderline and goes to manual review. Laptop
  webcams often score just under 0.5 on a real person, which used to be an
  automatic decline. It may not sit above the liveness threshold. A failed
  challenge sequence now scores 0, so it is always declined.
- **Searchable country screen.** The widget's country step is now a search box
  over a scrollable list, matching names from the start of any word and ignoring
  accents ("cote" finds Côte d'Ivoire), or a two-letter code. The preselected
  country sits at the top, highlighted.

### Fixed

- **The widget's country list was missing about 50 issuing countries and
  territories** (Côte d'Ivoire, Palestine, Kosovo, Taiwan, Hong Kong, Puerto
  Rico and others). It now lists every ISO 3166-1 country plus Kosovo,
  alphabetically.

## [2.3.5] - 2026-10-21

### Fixed

- **Liveness: close-up selfies still declined as screen replays.** On a laptop,
  a face can stay larger than the framing window through the whole active
  sequence, so 2.3.4 never caught a well-framed frame and sent the close-up
  (measured at 96% of the frame height, a crop narrower than the face).
  - Active liveness now frames the face first ("Move back a little" until it
    fits), takes the still there, then starts the challenges.
  - A crop too tight for the anti-spoofing model to judge (`cropScale` under
    1.5) is no longer called a spoof: it passes with a zero score, which sends
    the session to manual review, and raises a new `faceTooClose` signal. This
    also covers older widgets.

## [2.3.4] - 2026-10-21

### Fixed

- **Liveness: real people rejected as screen replays.** The anti-spoofing model
  (MiniFASNetV2) looks at a crop 2.7× the face, which only fits when the face is
  under ~37% of the frame's height. The widget accepted selfies with the face up
  to 85% of the frame, and active liveness took its still at the end of the
  sequence (often right after "move closer"), so the model saw a much tighter
  crop than it was trained on and confidently scored a live face as a spoof.
  - The selfie camera now frames the face at 20–40% of the frame height, and says
    "Move back a little" when it's too close (it used to say "Center your face").
  - Active liveness keeps the first well-framed frame as its still selfie.
  - The liveness result's `raw` records `faceHeightRatio` and the actual
    `cropScale`, to diagnose any remaining false rejections.

## [2.3.3] - 2026-10-21

### Changed

- **Widget: the issuing country has its own screen.** It used to be a dropdown
  among the document-type buttons, easy to skip, so sessions often reached OCR
  with no country and country-specific document parsers didn't run. The widget
  now asks the user to choose their country first (Continue stays disabled until a
  country is chosen), then the document type, with a "Change country" link back.

### Added

- **`defaultCountry` widget option** (`@arkyc/widget` and the SDK's
  `ArkycWidget.open`): preselects the country screen, e.g. `NG`. Without it the
  widget preselects the region of the browser's language (`en-NG` → `NG`). The
  hosted `/verify` page reads it from `?country=`, and the handoff QR carries it
  to the phone.

## [2.3.2] - 2026-10-21

### Fixed

- **AI OCR answered with the authenticity read alone.** Both Gemma 4 and Llama 4
  Scout called the tool with only `authenticityConfidence` and observations (e.g.
  "heavy glare"), leaving every identity field out, so OCR fell back to Tesseract.
  The prompt led with authenticity and said to omit unreadable fields, and the
  schema required nothing. The identity fields are now required (an empty string
  when unreadable or not printed), and the prompt makes reading them the main task.
- **Nigerian NIN slip and voter card parsers ran only when the country was
  `NG`.** The widget doesn't always send a country, and the registry skips a
  country-scoped parser when none is given, so a slip went to the generic
  scraper and only its date of birth was read. Both parsers now also run when no
  country was selected (still declining any other named country), and recognise
  the document from its own wording.
- **NIN slip names behind OCR noise.** A 720p capture puts stray marks before
  the given names (`| bt NGOZI, AMAKA`); they are now found anywhere on the line.

## [2.3.1] - 2026-10-21

### Fixed

- **Widget: document photos were captured at 640×480.** The camera was opened
  without a resolution, so browsers used their 640×480 default and a card's
  names and numbers came out a few pixels tall. OCR (AI and Tesseract alike)
  then read little beyond the boldest field, such as the date of birth. The
  document camera now asks for 1080p (`ideal`, so it still opens on cameras
  that can't deliver it); the selfie camera is unchanged.

## [2.3.0] - 2026-10-21

### Added

- **Document parsers for IDs without an MRZ** (tried after the MRZ, before the
  generic scraper):
  - Nigerian NIN slip: NIN, date of birth, issue date, given names, and the
    surname when OCR reads it cleanly.
  - EU-format driving licences (EU, EEA, UK, Switzerland) by their numbered
    fields, tolerating common OCR misreads of the markers ("42." for "4a.").
  - Nigerian voter card (PVC): VIN (read from the back's cleaner print when
    present), surname, given names, date of birth and registration date.
  - Indian Aadhaar (number checked with its Verhoeff check digit) and PAN cards.
  - A labelled-field parser for any country: cards that print English or French
    labels ("Surname", "Date of Birth", "Licence No", "Prénoms"…), such as the
    Nigerian driving licence.

### Changed

- **OCR fills gaps from the fallback driver.** A primary (AI) read that misses a
  name, the document number or the date of birth is kept, and the fallback
  driver fills only the fields it left empty. Before, any field at all (e.g. a
  lone date of birth) stopped the fallback, so the session had no name or number.

## [2.2.0] - 2026-10-21

### Added

- **Face-match reject floor** (`faceMatchRejectThreshold`, per project, dashboard
  Settings → Verification thresholds). Unset, the face-match driver's verdict
  decides and a failed match is rejected, as before. Set, the similarity score
  decides: below the floor is rejected, from the floor up to `faceMatchThreshold`
  goes to manual review, above it auto-approves. ID-card portraits score lower
  against a live selfie, so this lets weak-but-genuine ID matches reach a
  reviewer instead of an automatic rejection.

- **Configurable AI OCR timeout and retries:** `OCR_AI_TIMEOUT_MS` (default
  `30000`) and `OCR_AI_MAX_RETRIES` (default `2`). The `ai` driver always
  accepted them, but the app never passed them, so a slow model (e.g. a 26B
  Workers AI vision model) timed out on every attempt and OCR fell back.

### Changed

- **Project thresholds are validated.** Each must be a number from 0 to 1;
  `null` clears an override; unknown keys are dropped; the reject floor may not
  exceed `faceMatchThreshold` (all `422`). Previously any value was stored.

### Fixed

- **A handled error no longer kills the process.** `reportError` logged through
  `Logger.error`, which exits by default, so every reported error, though caught,
  exited the API or queue worker. In the worker it struck mid-job: e.g. the
  device risk detector reporting a missing GeoIP database
  (`storage/geoip/GeoLite2-Country.mmdb`) killed the worker, PM2 restarted it,
  and Redis re-delivered the job every `QUEUE_RETRY_AFTER`, so the session never
  got its decision and expired in `processing`. It now logs and carries on.

### Docs

- **GeoIP setup.** The provider guide now covers the `maxmind` network driver end
  to end: getting a MaxMind licence key, downloading GeoLite2 Country and ASN
  (`geoipupdate` or direct download), the optional Anonymous IP database and Tor
  exit list, where to keep the files so they survive deploys
  (`shared/storage/geoip`), restarting the API and worker, and scheduled updates.

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
