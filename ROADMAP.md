# Arkyc — Development Roadmap

> Open-source identity verification platform built on **[Arkstack](https://arkstack.toneflix.net/)** (runtime-agnostic TypeScript backend) and **Arkormˣ** (its ORM).

This roadmap breaks Arkyc into sequential, shippable phases. Each phase has a clear **goal**, **scope**, **deliverables**, and **exit criteria** (definition of done). Phases are ordered so that each builds on a working foundation — you should be able to stop after any phase and have something coherent.

**Progress legend:** `- [ ]` not started · `- [x]` done. Check off each scope task as it lands. Phase status: ✅ done · 🚧 in progress · ⬜ not started.

---

## Guiding Principles

- **Tenant isolation first.** Every table, query, storage path, and API route is tenant/project scoped from day one. Retrofitting multi-tenancy is the #1 thing we refuse to do later.
- **Strong package boundaries.** Business logic lives in `packages/*`; apps (`api`, `dashboard`, `playground`) are thin consumers. The decision engine, permissions, and providers must be unit-testable without an HTTP server or DB.
- **Driver-based providers.** OCR, liveness, face-match, storage, and webhooks all ship a `mock` driver first. The platform must be fully demoable end-to-end with mocks before any real provider is wired in.
- **Contracts before implementations.** `packages/types` defines the shared shapes; everything else conforms to them.
- **Vertical slices over horizontal layers.** Once the foundation exists, we build one capability end-to-end (DB → core → API → SDK → dashboard) before moving to the next, so the platform is always demoable.

---

## Tech Stack Recap

| Layer             | Choice                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Backend framework | Arkstack (Express driver, full template)                                                                                          |
| ORM / migrations  | Arkormˣ                                                                                                                           |
| Database          | PostgreSQL                                                                                                                        |
| Async work        | Arkstack queue + jobs (`@arkstack/queue` + `@arkstack/jobs`); `sync` inline in dev, `database`/`redis` + `ark queue:work` in prod |
| Storage           | S3-compatible (local driver for dev)                                                                                              |
| Dashboard         | React + React Router + shadcn/ui + Tailwind -–                                                                                    |
| SDK               | TypeScript (browser + server)                                                                                                     |
| Widget            | Framework-agnostic embeddable (overlay / inline / hosted)                                                                         |
| Monorepo          | pnpm workspaces (recursive `pnpm -r` scripts)                                                                                     |

---

## Phase Overview

| #   | Phase                                      | Status | Outcome                                                                                                                                    |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Monorepo & Tooling Foundation              | ✅     | Workspace builds, lints, and tests green                                                                                                   |
| 1   | Shared Contracts (`types`, `core`, `auth`) | ✅     | Domain types + decision engine unit-tested                                                                                                 |
| 2   | Data Model & Migrations                    | ✅     | All tables migrated, tenant-scoped, seeded                                                                                                 |
| 3   | Permissions & RBAC                         | ✅     | `resolvePermissions`/`authorize` working + default roles                                                                                   |
| 4   | API Foundation & Auth                      | ✅     | Arkstack API boots; tenant-aware auth + dashboard auth routes                                                                              |
| 5   | Tenants, Projects & API Keys               | ✅     | Tenant/project/role/member/key + project-member management; audit emission wired (Phase 9)                                                 |
| 6   | Verification Session Engine (mock e2e)     | ✅     | Public + client APIs walk a session to a decision via inline mocks; expiry + retry-limit enforced                                          |
| 7   | Provider Packages (drivers)                | ✅     | ocr/liveness/face-match packages with `mock` + `external` drivers (config-selected); file storage via Arkstack `Storage` (S3/MinIO/R2/GCS) |
| 8   | Workers & Async Pipeline                   | ✅     | Postgres-backed queue + `ark queue:work`; document→ocr, complete→biometric run async to a decision (retry/backoff/dead-letter)             |
| 9   | Reviews & Audit Logging                    | ✅     | Review queue + approve/reject/retry/assign/suspicious/note; audit trail (review + session + dashboard CRUD) + read API                     |
| 10  | Webhooks                                   | ✅     | Signed (HMAC) webhook delivery per project; endpoint CRUD + test, queue-backed delivery worker with retries/`webhook_deliveries`           |
| 11  | TypeScript SDK                             | ✅     | `@arkyc/sdk` server client (sessions create/retrieve/cancel, typed errors, webhook verify) + `@arkyc/sdk/browser` widget launcher          |
| 12  | Widget                                     | ✅     | `@arkyc/widget` full verification flow (overlay/inline/hosted) driving the Client API                                                      |
| 13  | Dashboard                                  | ✅     | Multi-tenant React Router dashboard (Vite + Tailwind + alova); permission-aware UI                                                         |
| 14  | Playground & Docs                          | ✅     | Runnable example integration + VitePress documentation site                                                                                |
| 15  | Platform Admin & Global Settings           | ✅     | Super-admin tier above tenants (admin RBAC + `/admin`) + a typed global settings store/UI; platform actions audited separately             |
| 16  | Realtime Event Delivery                    | ✅     | Transport abstraction with **pusher** (hosted or self-hosted soketi) + **firebase** drivers (admin-selectable); live dashboard updates     |
| 17  | Improved Capture & Liveness Flow           | ✅     | Server-issued active-liveness challenges + improved document capture (glare hints/auto-capture); capture model resolves project > global   |
| 18  | Dashboard Revamp                           | ⬜     | Re-skin to the shadcn UI kit design system (default + project-management layouts)                                                          |
| 19  | Hosted Website & Custom Docs Theme         | ⬜     | Public marketing/docs site + bespoke VitePress theme; integration documentation                                                            |
| 20  | Hardening & Release                        | ⬜     | Security, rate limits, retention, v0.1.0                                                                                                   |

---

## Phase 0 — Monorepo & Tooling Foundation ✅

**Goal:** A clean, buildable monorepo skeleton with every package/app stubbed.

**Scope**

- [x] Initialize git, pnpm workspaces, root `package.json`, `tsconfig.base.json`.
- [x] Recursive `pnpm -r` scripts for `build`, `dev`, `lint`, `test`, `typecheck`.
- [x] Scaffold the full directory tree:
  ```
  apps/{api,dashboard,playground}
  packages/{auth,core,types,sdk,widget,ocr,liveness,face-match,webhooks,permissions}
  docs/
  ```
- [x] Shared config: ESLint, Prettier, Vitest, `tsdown`/`tsc` build for packages.
- [x] Each package has a minimal `index.ts`, `package.json`, and `tsconfig.json` that compiles.
- [x] Root `README.md` and this `ROADMAP.md`. `.env.example`, `.gitignore`, `.editorconfig`.
- [x] Docker Compose for local Postgres + S3 (MinIO).
- [x] Scaffold `apps/api` with the real Arkstack (Express, full) template via `create-arkstack`.
- [x] Align the workspace toolchain to the Arkstack app (tsdown, vitest 4, typescript 6, eslint 10, `@types/node` 25); single root `tsdown.config.ts` (workspace mode) builds all libs/workers.
- [x] `pnpm install` at the workspace root resolves cleanly.
- [x] `pnpm build && pnpm lint && pnpm test && pnpm typecheck` pass across the workspace.

**Deliverables:** Empty-but-wired monorepo; `pnpm build && pnpm lint && pnpm test` pass.

**Exit criteria:** Fresh clone → `pnpm install && pnpm build` succeeds with zero packages containing real logic yet.

---

## Phase 1 — Shared Contracts: `types`, `core`, `auth` ✅

**Goal:** Lock the domain vocabulary and the pure logic that has no infra dependencies.

**Scope**

- [x] **`packages/types`** — all shared types from the spec: `Tenant`, `TenantMember`, `Project`, `ProjectMember`, `Role`, `Permission`, `RolePermission`, `UserPermission`, `VerificationStatus`, `VerificationDecision`, `DecisionReason`, `VerificationSession`, `DocumentCapture`, `OcrResult`, `LivenessCheck`, `FaceMatchCheck`, `Review`, `WebhookEvent`, `SdkOptions`, `WidgetOptions`. Provider result shapes (OCR/liveness/face-match).
- [x] **`packages/core` — decision engine** — takes OCR confidence, document quality, expiry, liveness, face-match scores + thresholds → `approved | requires_review | rejected` + `DecisionReason`.
- [x] **`packages/core` — status transition map** — valid `VerificationStatus` transitions; reject illegal ones.
- [x] **`packages/core` — helpers** — session expiry checks, risk scoring helpers, result normalization, tenant/project context helpers.
- [x] **`packages/core` — default thresholds** (`documentQuality 0.75`, `ocrConfidence 0.8`, `liveness 0.85`, `faceMatch 0.75`).
- [x] **`packages/auth`** — framework-neutral helpers (lean, complements `@arkstack/auth`): password hashing, session helpers, token helpers, API key generation/hashing (`key_prefix` + `key_hash`), short-lived client token helpers.

**Deliverables:** Three published-internal packages with comprehensive Vitest suites.

**Exit criteria:** Decision engine has table-driven tests covering every `DecisionReason`. `core` and `auth` have **no** dependency on Arkstack or the DB.

---

## Phase 2 — Data Model & Migrations (Arkormˣ) ✅

**Goal:** Every entity migrated, tenant-scoped, with seed data.

**Scope**

- [x] Arkormˣ models + migrations for all tables: `users`, `tenants`, `tenant_members`, `tenant_invitations`, `roles`, `permissions`, `role_permissions`, `user_permissions`, `projects`, `project_members`, `api_keys`, `verification_sessions`, `document_captures`, `ocr_results`, `document_portraits`, `liveness_checks`, `face_match_checks`, `reviews`, `review_notes`, `webhook_endpoints`, `webhook_deliveries`, `audit_logs`.
- [x] Enforce columns exactly as specified (e.g. `verification_sessions` has `auto_decision`, `final_decision`, `decision_reason`, `risk_score`, `client_token_hash`, `expires_at`, etc.).
- [x] Foreign keys + indexes on `tenant_id` / `project_id` on every scoped table.
- [x] Relationships defined in models (tenant → projects → sessions → captures/checks/reviews) using Arkormˣ `hasMany`/`belongsTo`/`belongsToMany` so the app can eager-load (`.with()`) and aggregate (`withCount`).
- [x] Factories + seeders: a demo tenant, projects, default roles/permissions, sample users.
- [x] Permission catalogue + default system-role definitions added to `@arkyc/permissions` (data; Phase 3 adds the resolver/sync).
- [x] Verified against Postgres: `ark migrate` (28 migrations) forward + `migrate:rollback`, and `ark seed` produces the demo workspace.

**Deliverables:** `ark migrate` runs cleanly forward and back; `ark db:seed` produces a demo workspace.

**Exit criteria:** A seeded DB where a demo tenant has projects, members, roles, and at least one fixture verification session per status.

---

## Phase 3 — Permissions & RBAC (`packages/permissions`) ✅

**Goal:** Flexible, tenant- and project-aware access control usable by api, dashboard, and sdk.

**Scope**

- [x] `definePermission()` — register permission strings + groups (custom registry + `allKnownPermissions`).
- [x] `syncDefaultPermissions()` — upsert the full permission catalog (tenants/members/projects/api_keys/webhooks/sessions/reviews/audit_logs/settings/billing groups).
- [x] `syncDefaultRoles()` — create system roles `owner`, `admin`, `reviewer`, `developer`, `readonly` with their permission sets.
- [x] `resolvePermissions({ userId, tenantId, projectId })` — union of: tenant role perms + project role perms + direct tenant user perms + direct project user perms, **deduplicated**.
- [x] `hasPermission(perms, 'sessions.view')` (+ `hasAny`/`hasAll`/`ensurePermission`) and `authorize(ctx, permission, store)` (throws `PermissionDeniedError`).
- [x] Effective set = `role_permissions + direct_user_permissions`.
- [x] Pure where possible; DB access behind store ports (`PermissionResolverStore`/`PermissionSyncStore`) so it's testable with fakes. The Arkormˣ-backed store implementation lands with the API in Phase 4/5.

**Deliverables:** `packages/permissions` with the six exported functions + tests for resolution precedence and dedup.

**Exit criteria:** Given the spec's "Jane the reviewer + `api_keys.view`" example, `resolvePermissions` returns exactly the expected union.

---

## Phase 4 — API Foundation & Authentication ✅

**Goal:** Arkstack API boots and authenticates dashboard users with tenant context.

**Scope**

- [x] `apps/api` Arkstack app wired to Postgres + Arkormˣ (migrations run; routes under `/api`).
- [x] HTTP module structure: controllers, class-based middleware, services, `support/` helpers (further domain modules land per phase).
- [x] **Auth middleware (Dashboard API)** — built-in Arkstack `auth` (bearer JWT) → `req.authUser`; `resolveTenant` resolves the active tenant from `:tenantId` + membership.
- [x] **Auth middleware (Public Project API)** — `apiKeyAuth`: secret API key (`Bearer sk_…`/`X-Api-Key`) → resolves tenant+project; touches `last_used_at`.
- [x] **Auth middleware (Client/Widget API)** — `clientTokenAuth`: short-lived client token → resolves session (rejects expired).
- [x] `can(permission)` guard factory enforcing permission strings via `@arkyc/permissions` + the Arkormˣ resolver store.
- [x] Dashboard auth routes (Arkstack built-in auth): register, login, logout, `me`, accept invitation.
- [x] Standard `{ status, message, data|errors }` envelope + `requestId` correlation middleware.

**Deliverables:** Bootable API with health check + working auth on a protected sample route per surface.

**Exit criteria:** A user can register, log in, and hit a tenant-scoped route that is denied without the right permission and allowed with it. ✅ Covered by **parasito** integration tests (no live server): register/login/me, owner allowed, reviewer-role member denied (`403 Permission denied: tenants.view`), non-member denied, API-key + client-token surfaces 200/401.

---

## Phase 5 — Tenants, Projects, Members & API Keys ✅

**Goal:** Full multi-tenant management through the Dashboard API.

**Scope**

- [x] Tenant CRUD + tenant switching support (slug-based), `settings` JSON.
- [x] Tenant members + invitations (email + `token_hash` + expiry + accept flow).
- [x] Roles & permissions management endpoints (list/create/edit roles, assign/remove permissions, list permission catalog, system-role indicators).
- [x] Member direct permissions: view role perms / direct perms / effective perms; assign role; add/remove direct perms.
- [x] Projects CRUD with `environment`, `settings`, `branding`, project-level verification thresholds.
- [x] Project members.
- [x] API keys: create (return secret once), list, revoke; store `key_prefix` + `key_hash`; track `last_used_at`.
- [x] All endpoints permission-gated and tenant-scoped; audit logs emitted on every mutation (wired in Phase 9).

**Deliverables:** All `/v1/dashboard/...` tenant/project/member/role/key routes from the spec.

**Exit criteria:** Through the API alone you can create a tenant, invite a member, create a project, mint an API key, and configure thresholds/branding.

---

## Phase 6 — Verification Session Engine (mock end-to-end) ✅

**Goal:** Full session lifecycle driven by the public + client APIs, using mock providers inline (no workers yet).

**Scope**

- [x] **Public Project API** (secret key): `POST /v1/sessions`, `GET /v1/sessions/:id`, `POST /v1/sessions/:id/cancel`. Issues a short-lived **client token** for the widget.
- [x] **Client/Widget API** (client token): `GET /v1/client/session`, `POST /v1/client/document/{front,back}`, `POST /v1/client/liveness`, `POST /v1/client/complete`.
- [x] Session state machine wired to `packages/core` status transitions: `pending → started → document_submitted → liveness_submitted → processing → (approved | rejected | requires_review)`; plus `expired`, `cancelled`.
- [x] Persist `document_captures`, `ocr_results`, `document_portraits`, `liveness_checks`, `face_match_checks` (initially via **inline mock providers**, swapped to workers in Phase 8).
- [x] Run the decision engine; write `auto_decision`, `final_decision`, `decision_reason`, `risk_score`.
- [x] Session expiry + retry-limit enforcement. _(lazy `expired` transition via `shouldExpireSession`; liveness attempts capped at 3.)_

**Deliverables:** A scripted run (curl/SDK-less) that creates a session and walks it to a decision using mocks.

**Exit criteria:** A session created via the public API can be completed via the client API and lands in `approved`/`rejected`/`requires_review` with a correct `decision_reason`.

---

## Phase 7 — Provider Packages (drivers) ✅

**Goal:** Replace inline mocks with real driver-based provider packages.

**Scope**

- [x] **File storage** — use Arkstack's `Storage` (`@arkstack/filesystem`, flydrive-based: `put`/`getBytes`/`getUrl`/`getSignedUrl`/`exists`/`delete`) instead of a bespoke package. Captures are written private under tenant/project-scoped keys. The framework's `s3` disk is **S3-compatible** and already covers AWS S3, **MinIO** (in docker-compose) and **Cloudflare R2** (R2 speaks the S3 API — just point `endpoint`/`bucket`/keys at it); a `gcs` disk and `local`/`ftp` round it out. Switching backends is `config/filesystem` + env, no code changes. _(No custom `packages/storage` — redundant with the framework.)_
- [x] **`packages/ocr`** — drivers `mock` (dev/test) + `external` (HTTP). Returns `{ fields, confidence, raw }`.
- [x] **`packages/liveness`** — drivers `mock` + `external` (HTTP). Returns `{ passed, score, spoofSignals, raw }`.
- [x] **`packages/face-match`** — drivers `mock` + `external` (HTTP). Returns `{ passed, similarityScore, confidence, raw }`.
- [x] Common driver-registry pattern (`create*Driver(config)` selects active driver; `apps/api` wires them from env, default `mock`/`local`).

Each analyzer ships two real drivers: `mock` (deterministic, for dev/test) and `external` (POSTs the image to a configured HTTP endpoint and maps the response) — so production providers are integrated by config alone. A self-hosted model server is just an `external` endpoint.

**Deliverables:** Three analyzer packages (ocr/liveness/face-match) with a uniform driver interface + `mock` parity with Phase 6; file storage via the framework's `Storage`.

**Exit criteria:** Switching a driver via config (`OCR_DRIVER=mock|external`, `STORAGE_DRIVER`/disk, …) changes behaviour with no call-site changes; documents land in storage and are retrievable via signed URL. ✅ Covered by the package suites + `tests/sessions.test.ts`.

_Future enhancement (not blocking): bundled in-process analyzer drivers (WASM Tesseract, an on-box liveness/face model) as alternatives to the `external` HTTP path._

---

## Phase 8 — Workers & Async Pipeline ✅

**Goal:** Move heavy processing off the request path into queue workers.

**Scope**

- [x] Queue abstraction — durable **Postgres-backed** `jobs` table + `Queue` service (`enqueue`/`claim`/`complete`/`fail`), claimed atomically with `UPDATE … RETURNING` over `FOR UPDATE SKIP LOCKED`. Shared by API + the worker command.
- [x] **`ocr` queue** — consumes document jobs → runs the `ocr` driver + portrait extraction → persists results (idempotent).
- [x] **`biometric` queue** — consumes jobs → runs `face-match` + the decision engine → sets `auto_decision`/`final_decision`/`risk_score` and the final status. (Liveness stays inline — cheap check; keeps the per-session attempt limit simple.)
- [x] API enqueues jobs instead of running providers inline; `complete` moves the session to `processing` until a worker lands the decision.
- [x] Idempotency (handlers no-op on re-delivery), retries with quadratic backoff, dead-letter after max attempts, and a visibility-timeout reaper for crashed workers (at-least-once).

**Deliverables:** `ark queue:work [queue] [--once]` runnable worker command (Arkstack console; shares the app's models/DB). Run `ark queue:work ocr` and `ark queue:work biometric` as separate processes for the two roles. The empty `workers/*` scaffold packages were retired in favour of the in-app command. The session flow now completes asynchronously.

**Exit criteria:** Submitting documents/selfie enqueues work; sessions reach a decision via the worker; a reserved job from a crashed worker is reclaimed after the visibility timeout (no corruption). ✅ Covered by `tests/queue.test.ts` (claim/retry/backoff/dead-letter) + `tests/sessions.test.ts` (async walk to decision via `drain()`).

_Operational notes (not blocking): run the two roles as separate long-lived processes (`ark queue:work ocr`, `ark queue:work biometric`); a Redis/BullMQ backend is an optional swap behind the same `Queue` interface._

---

## Phase 9 — Reviews & Audit Logging ✅

**Goal:** Human-in-the-loop review + a complete audit trail.

**Scope**

- [x] Review queue: list/get tenant sessions with filters (status, decision reason, project). Per-reviewer assignment (`assigned_to` column + `POST .../assign`) and reviewer notes via `ReviewNote`.
- [x] Actions: approve, reject, request document/selfie/full retry, mark suspicious, add note — each transitions the session (where applicable), records a `reviews` row (`previous_status`/`new_status`/`reason`) + stamps `reviewed_at`/`reviewed_by`.
- [x] Dashboard API: `.../sessions/:id/{approve,reject,request-retry,assign,suspicious,notes}` + `GET .../sessions` (filtered) and `GET .../sessions/:id`, gated by `sessions.view` / `reviews.*`.
- [x] **Audit logging**: `AuditLogger` service (`actor_id`/`actor_type`/`action`/`entity_type`/`entity_id`/`metadata`/`ip_address`/`user_agent`) + `GET /v1/dashboard/tenants/:id/audit-logs` (gated `audit_logs.view`, filterable). Emitted on review actions, `session.created` (api_key actor), and `session.auto_decided` (system actor).
- [x] Retro-fill audit emission across the dashboard CRUD: tenant, project, project-member, tenant-member (invite / role / direct-permission), role, and api-key create/update/remove. _(Auth register/login isn't tenant-scoped so it's outside the tenant audit log; webhook events land with Phase 11.)_

**Deliverables:** Reviewer endpoints + audit-log read API; every tenant-scoped state-changing action writes an audit row.

**Exit criteria:** A `requires_review` session can be approved/rejected by a permitted reviewer, status + decision reason update correctly, and the action appears in audit logs. ✅ Covered by `tests/reviews.test.ts` (review actions, assign, mark-suspicious, CRUD audit trail).

---

## Phase 10 — Webhooks (`packages/webhooks`) ✅

**Goal:** Reliable, signed event delivery per project.

**Scope**

- [x] `packages/webhooks`: `signWebhook`, `verifyWebhookSignature` (timestamp tolerance + constant-time compare), `buildWebhookPayload`. HMAC-SHA256 over `${timestamp}.${body}`; headers `X-Arkyc-Signature`, `X-Arkyc-Timestamp`.
- [x] Webhook endpoint management per project (URL, signing secret shown once, subscribed `events`, status) + `POST .../webhooks/:id/test`. Gated `webhooks.*`.
- [x] Emit events `verification.{started,document_submitted,processing,requires_review,approved,rejected,completed,expired,cancelled}` from a single `transitionTo` choke point (covers the service, biometric worker, and review actions).
- [x] Delivery worker (`webhook` queue): signs + POSTs, records `webhook_deliveries` (`attempts`, `response_status`/`body`), retries with backoff + dead-letters via the Phase 8 queue.
- [x] Payload matches the spec shape (session/tenant/project/user_reference/status/checks/decision_reason).

**Deliverables:** Endpoint CRUD + test delivery, the delivery worker, and signing utilities with verification tests.

**Exit criteria:** Completing a session POSTs a correctly-signed payload to the configured endpoint; failures retry and are visible in `webhook_deliveries`. ✅ Covered by `packages/webhooks` tests + `tests/webhooks.test.ts` (live local receiver verifies the signature; unreachable endpoint records a failed delivery).

_Note: the signing secret is stored as-is for re-signing deliveries (column named `secret_hash`); encryption-at-rest is a Phase 20 hardening item._

---

## Phase 11 — TypeScript SDK (`@arkyc/sdk`) ✅

**Goal:** Clean DX for integrators, server + browser.

**Scope**

- [x] **Server SDK:** `new Arkyc({ secretKey, baseUrl?, fetch? })`, `arkyc.sessions.create/retrieve/cancel`, typed responses + typed `ArkycApiError`, `arkyc.webhooks.verify` (re-exports `@arkyc/webhooks`).
- [x] **Browser SDK:** `@arkyc/sdk/browser` → `ArkycWidget.open({ token, onComplete, onError })` overlay-iframe launcher with `postMessage` relay (consumes the Phase 12 hosted widget).
- [x] Reuses `packages/types` for `VerificationStatus`/`VerificationDecision`/`DecisionReason`/`Metadata`.
- [x] Dual-entrypoint build (`.` + `./browser`) via the workspace tsdown glob; README with server/webhook/browser usage examples.

**Deliverables:** `@arkyc/sdk` package with server + browser entrypoints and tests.

**Exit criteria:** The server SDK can create + fetch + cancel a session; webhook verification validates a real signed payload; the browser launcher opens the widget with a client token. ✅ Covered by `tests/sdk.test.ts` (mock-fetch create/retrieve/cancel + typed error + real signed-payload verify) and `tests/browser.test.ts` (fake-DOM launcher).

_Note: the browser launcher points at the hosted widget origin; the actual widget UI lands in Phase 12. CJS output can be added to the build if a non-ESM consumer needs it._

---

## Phase 12 — Widget (`@arkyc/widget`) ✅

**Goal:** Polished, mobile-friendly embeddable verification flow.

**Scope**

- [x] Framework-agnostic widget: `ArkycWidget.open(...)` (overlay) and `ArkycWidget.mount(...)` (inline), plus `ArkycWidget.hosted()` for the hosted page. Pure, DOM-injectable core (`flow`/`client`/`theme`) so it's testable without a browser.
- [x] Modes: `overlay`, `inline`, `hosted`.
- [x] Flow screens: Welcome → Document Selection → Front Capture → Back Capture → OCR Processing → Selfie Capture → Passive Liveness → Face Match → Processing → Result. `back_capture` auto-skipped for single-sided documents (passports); cosmetic processing screens auto-advance; final `processing` polls the session to a terminal status.
- [x] Camera capture (document + selfie) via `getUserMedia` + canvas frame grab, with a file-input fallback; client-side mock signal hints; talks only to the **Client/Widget API** (`GET /v1/client/session`, `POST /v1/client/document/{front,back}`, `/liveness`, `/complete`) with the short-lived client token (`X-Client-Token`).
- [x] Customization: brand colors, logo, border radius, light/dark theme via CSS variables; branding sourced from project config.
- [x] Posts `arkyc:complete` / `arkyc:error` / `arkyc:close` to the parent window — the contract `@arkyc/sdk/browser`'s `ArkycWidget.open()` launcher already listens for.

**Deliverables:** `@arkyc/widget` bundle — ESM + `.d.ts` (workspace `tsdown`) plus a minified IIFE/UMD browser global (`Arkyc`, `build:standalone`) usable standalone or via the SDK browser launcher.

**Exit criteria:** A user completes a full document + selfie verification in overlay and inline modes on mobile + desktop, themed from project branding. ✅ Covered by `tests/{flow,client,theme,widget}.test.ts` (pure step-machine + envelope client + theme + a fake-DOM controller walk: passport→approved with `arkyc:complete`, two-sided back-capture, API-failure→`arkyc:error`, close→`arkyc:close`, and the `open`/`mount`/`hosted` launchers).

---

## Phase 13 — Dashboard (`apps/dashboard`) ✅

**Goal:** Complete multi-tenant management UI.

**Scope**

- [x] React + React Router + Tailwind v4 + **alova** (strategy hooks: `useRequest`/`usePagination`/`useWatcher`/`useForm`) (Vite app), with a shadcn component kit (`components/ui/*`). Auth (login/register/onboarding) + tenant switching (slug-based). _(Data layer migrated off react-query to alova; growth-prone lists paginate. Component kit is mostly hand-rolled shadcn-style, with `field`/`input-group` pulled via the shadcn CLI — `components.json` present.)_
- [x] Form validation UX: shadcn `Field`/`FieldLabel`/`FieldError` + `InputGroup` wired to alova's typed `ValidationException` — inline per-field errors (`error.list[field]`), `aria-invalid` error styling, and reactive clearing on edit via `error.delete(field, update)`.
- [x] Route tree from the spec: `/t/:tenantSlug/{overview,projects,projects/:id/{api-keys,webhooks},sessions,sessions/:id,reviews,audit-logs,settings,settings/roles,settings/roles/:id,settings/permissions,members,members/:id,members/:id/permissions}`.
- [x] Pages: Overview (metrics), Tenant Settings, Role Management (grouped permission editor; system roles read-only), Member Permissions (role/direct/effective), Projects (keys/webhooks/origins/branding/thresholds), Sessions list (filters), Session Detail (decision/checks/details), Review Queue (approve/reject/retry/notes + assign/suspicious).
- [x] **Permission-aware UI:** nav + action buttons render from the user's effective permissions. Backed by a new `GET /v1/dashboard/tenants/:tenantId/me` endpoint (any member) that resolves the caller's role/direct/effective permissions.

**Deliverables:** Deployable dashboard consuming the Dashboard API end-to-end (`vite build`); typed `lib/api.ts` client + auth/tenant contexts.

**Exit criteria:** An owner can manage tenant/projects/roles/members; a reviewer (role-limited) sees only review-relevant nav/actions and can clear the review queue. ✅ tsc + `vite build` + eslint green; `tests/Layout.test.ts` asserts the reviewer-vs-owner nav gating; the `/me` endpoint is covered by `apps/api/tests/auth.test.ts`. _(Manual click-through against a live API is in progress; it has already surfaced and fixed: the alova fetch-`Response` clone bug on 422s, the post-login sidebar permissions race in `tenant-context` `useWatcher`, and the `dayjs` SWC-interop crash in the `users` console command. Full e2e walkthrough still outstanding.)_

---

## Phase 14 — Playground & Documentation ✅

**Goal:** Prove the integrator story and document it.

**Scope**

- [x] **`apps/playground`** — minimal example app: a Vite dev server whose backend plugin uses `@arkyc/sdk` (secret key, server-side) to open/retrieve sessions, the frontend mounts `@arkyc/widget` with the client token (widget `baseUrl: '/api'`, proxied to the API — no CORS), shows the decision, and a `POST /pg/webhooks/arkyc` receiver verifies + displays delivered events. _(`pnpm --filter @arkyc/playground dev`; see `apps/playground/README.md`.)_
- [x] **`docs/`** — VitePress site (`@arkyc/docs`): getting started, architecture, multi-tenancy, RBAC, API reference (overview/public/client/dashboard), SDK guide, widget integration, webhooks, provider drivers, self-hosting (Docker Compose), configuration/env reference. _(`pnpm --filter @arkyc/docs dev`; builds clean.)_

**Deliverables:** Runnable playground + a VitePress docs site covering the full integration path.

**Exit criteria:** A new developer can follow `docs/` + run the playground to complete a verification without reading source. ✅ Playground verified locally; docs site builds (`vitepress build`) with no dead links. _(End-to-end run against a live seeded API remains the manual verification step.)_

---

## Phase 15 — Platform Admin & Global Settings ✅

**Goal:** A platform **super-admin** tier above tenants, plus a global settings
store that gates app-wide behavior (feature toggles, realtime transport, which
capture model is offered).

**Scope**

- [x] Platform-admin auth scope, **distinct** from tenant RBAC — `admin` flag on `Permission`/`Role`, an `AdminPermission` grant table, a separate `canAdmin(...)` guard (no tenant scope; resolves only `admin_permissions`), `admin.*` catalogue + a `platform-owner` role, and an `ark admin:grant <email>` command.
- [x] Global settings store — a typed singleton `GlobalSettingsService` over a `global_settings` row, merged over defaults; runtime read path + admin write path.
- [x] Settings include realtime transport (`pusher` | `firebase` | `off`) + platform feature flags. _(Offered capture model lands with Phase 17.)_
- [x] Admin area — guarded `/admin` surface to edit global settings, list tenants, manage platform users (grant/revoke admin), and view the platform audit log. _(Platform-wide health view deferred.)_
- [x] Audit platform-admin actions separately — a dedicated `platform_audit_logs` table + `PlatformAuditLogger`.

**Deliverables:** A platform-admin can sign in and change global settings the rest of the app reads at runtime.

**Exit criteria:** Toggling a global setting (e.g. the realtime transport) changes app behavior without a redeploy; tenant users cannot reach platform-admin surfaces. ✅

---

## Phase 16 — Realtime Event Delivery ✅

**Goal:** Push live updates (sessions, webhooks, review queue) to clients via a
provider-abstracted transport, replacing polling.

**Scope**

- [x] Transport interface (`@arkyc/realtime`) with **pusher** (hosted Pusher Channels by default; self-hosted soketi opt-in via `PUSHER_HOST`) and **firebase** drivers, plus `memory` (tests) and `off` — selected by the Phase 15 global setting with an env fallback.
- [x] Server: publish from the single `transitionTo` choke point (session transitions) and `ReviewService.emit` (all review actions) to per-tenant/-project/-session channels. _(Webhook deliveries already fan out independently via `WebhookService`.)_
- [x] Channel authorization scoped to tenant/project/session (`POST /v1/realtime/auth`). _(Widget client-token channel auth deferred.)_
- [x] Clients: a realtime client in the dashboard (pusher-js/firebase, code-split) + `useRealtimeChannel`, wired into the review queue and session detail to update reactively. _(Playground subscription pending.)_
- [x] Infra: `soketi` in docker-compose; pusher/firebase via env (`PUSHER_*` / `FIREBASE_*`).

**Deliverables:** Dashboard review queue and playground webhooks update live; the transport is swappable by a platform-admin.

**Exit criteria:** A completed verification pushes to the dashboard in realtime; switching the transport in admin settings takes effect. ✅ _(Verified server-side via the `memory` driver + the real `pusher` lib; the live soketi/firebase WS round-trip and the playground subscription remain to confirm with the infra running.)_

---

## Phase 17 — Improved Capture & Liveness Flow ✅

**Goal:** A higher-quality, more spoof-resistant capture experience with **active**
liveness, offered per the admin's global capture-model setting.

**Scope**

- [x] New widget flow: guided **active liveness** (server-issued turn/blink/smile/nod/move-closer challenges, camera + recorded video) and improved document capture (live glare/brightness hints + auto-capture). _(Edge detection approximated by a brightness/glare heuristic.)_
- [x] Keep the current passive flow; the offered model (`passive` | `active` | `both`) resolves from the global `capture.model` setting, overridable per project via `Project.settings.capture_model`.
- [x] Client/Liveness API + provider contract carry the challenge/response signals — `submitLiveness` takes `mode`/`video`/`challenges`; the `mock` driver validates the performed sequence against the issued one (parity, no real provider needed).
- [x] Branding/theming reused from Phase 12; mobile-first card UI. _(Full accessibility pass not audited.)_

**Deliverables:** `@arkyc/widget` supports both flows; the admin toggle selects which is offered.

**Exit criteria:** A user completes an active-liveness verification end-to-end; switching the offered model in admin settings changes the widget flow. ✅ _(Verified server-side + via the widget's fake-DOM unit tests; visual/in-browser UX not run here.)_

---

## Phase 18 — Dashboard Revamp ✅

**Goal:** A polished dashboard aligned to the **shadcn UI kit** design system.

**Scope**

- [x] Adopt the [shadcnuikit.com](https://shadcnuikit.com/dashboard/default) design language: refreshed shell (grouped sidebar + sticky topbar with tenant switcher, theme toggle, account dropdown), card-wrapped data tables, refined cards, recharts on the Overview, expanded empty/loading states.
- [x] Expand the shadcn component kit consistently (StatCard, Skeleton, Avatar, DropdownMenu, Tabs; sidebar + chart design tokens, Inter font, refined radii/scrollbars); dark/light theming; responsive.
- [x] Preserve the alova data layer and permission-aware UI — no API changes, full feature parity.

**Deliverables:** Redesigned dashboard shipping the new design system across all pages.

**Exit criteria:** Every existing dashboard flow works under the new design with parity and improved UX. ✅ _(Verified via typecheck + build + the dashboard unit tests; visual review done by the maintainer — no browser in this environment.)_

---

## Phase 19 — Hosted Website & Custom Docs Theme ✅

**Goal:** Two distinct public properties — a branded **open-source / white-label docs** site, and a sleek **hosted-product marketing site** for the SaaS.

**Scope**

- [x] **OSS / white-label docs** (`docs/`, VitePress): custom theme (`docs/.vitepress/theme/`) over the Phase 14 content — brand tokens (indigo/Inter) across nav/links/buttons/search in light + dark, brand mark + GitHub link, a `layout: page` landing, generated `sitemap.xml`, Open Graph/Twitter meta, env-gated **GA4**, and a GitHub Pages workflow (`.github/workflows/docs.yml`, base-path auto-derived; `DOCS_BASE`/`DOCS_SITE_URL`). Audience: developers self-hosting / white-labeling. _(The "current look is fine for white-label docs.")_
- [x] **Hosted-product marketing site** (`apps/website`, Vite + React + Tailwind v4 + **motion**): didit.me-style, sleek and animated — sticky blur nav, dark gradient hero with a self-running verification "sprite", capability marquee, scroll-reveal feature rows, animated stat counters, how-it-works, pricing, FAQ accordion, CTA band, footer. Reduced-motion respected. **Log in / Start free** link into the dashboard (`VITE_DASHBOARD_URL`).
- [x] **Customer-integration docs** on the hosted site (`apps/website/src/docs`): Getting started, Embed the widget, Server SDK, Webhooks — focused on a customer integrating the hosted product (not white-labeling). Separate from the OSS docs, which it links out to for self-hosting.

**Deliverables:** Branded VitePress OSS docs (deployable via Pages) + a new `apps/website` hosted-product marketing site with customer docs.

**Exit criteria:** Both build clean; a hosted-product visitor can go landing → customer docs → sign up (dashboard), and a self-hoster lands in the OSS docs. ✅ _(`pnpm --filter @arkyc/docs build` and `pnpm --filter @arkyc/website build` both clean; website typechecks.)_ _Follow-ups: pick the marketing-site host/domain + `VITE_DASHBOARD_URL`; replace placeholder URLs (`arcstack/arkyc`, `api.arkyc.dev`, `cdn.arkyc.dev`, `arkyc.dev`)._

---

## Phase 20 — Hardening & Release (v0.1.0) ⬜

**Goal:** Production-readiness pass and first tagged release.

**Scope**

- [ ] Security: rate limiting, allowed-origins enforcement per project, secret/key hashing audit, signed-URL TTLs, webhook signature hardening, client-token scoping, retry limits, session expiry sweeps.
- [ ] Data retention settings (per tenant) + media lifecycle/cleanup jobs.
- [ ] Observability: metrics, structured logs, error tracking hooks.
- [ ] Test coverage pass (unit + integration + a happy-path e2e), CI pipeline, release versioning, `CHANGELOG.md`, `LICENSE`, contribution guide.
- [ ] Performance: query/index review on hot tenant-scoped paths.

**Deliverables:** CI green, security checklist complete, tagged `v0.1.0`.

**Exit criteria:** Full demo (create → verify → decide → review → webhook → SDK) runs against a hardened build with rate limits, signed media, and retention active.

---

## Cross-Cutting Tracks (run continuously)

- [ ] **Testing** — every package ships unit tests; API integration tests per module; e2e on the critical verification path.
- [ ] **Audit & tenant-scoping review** — a recurring check that no query/route/storage path escapes tenant/project scoping.
- [ ] **DX** — typed errors, consistent envelopes, generated API types shared with the SDK.
- [ ] **CI/CD** — lint + typecheck + test + build on every PR from Phase 0.

---

## Suggested Milestones

- **M1 — Foundation (Phases 0–3):** monorepo, contracts, data model, RBAC.
- **M2 — Verification core (Phases 4–8):** API, tenants/projects, session engine, providers, workers.
- **M3 — Operations (Phases 9–10):** reviews, audit, webhooks.
- **M4 — Integration surface (Phases 11–14):** SDK, widget, dashboard, playground + docs.
- **M5 — Platform & realtime (Phases 15–16):** super-admin tier, global settings, realtime transports.
- **M6 — Experience (Phases 17–19):** active-liveness capture, dashboard revamp, hosted site + custom docs theme.
- **M7 — Ship (Phase 20):** hardening, `v0.1.0`.
