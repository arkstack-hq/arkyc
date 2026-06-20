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

| Layer             | Choice                                                           |
| ----------------- | ---------------------------------------------------------------- |
| Backend framework | Arkstack (Express driver, full template)                         |
| ORM / migrations  | Arkormˣ                                                          |
| Database          | PostgreSQL                                                       |
| Async work        | Postgres-backed job queue + `ark queue:work` (`ocr` / `biometric` roles) |
| Storage           | S3-compatible (local driver for dev)                             |
| Dashboard         | React + React Router + shadcn/ui + Tailwind                      |
| SDK               | TypeScript (browser + server)                                    |
| Widget            | Framework-agnostic embeddable (overlay / inline / hosted)        |
| Monorepo          | pnpm workspaces (recursive `pnpm -r` scripts)                    |

---

## Phase Overview

| #   | Phase                                      | Status | Outcome                                                       |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------- |
| 0   | Monorepo & Tooling Foundation              | ✅     | Workspace builds, lints, and tests green                      |
| 1   | Shared Contracts (`types`, `core`, `auth`) | ✅     | Domain types + decision engine unit-tested                    |
| 2   | Data Model & Migrations                    | ✅     | All tables migrated, tenant-scoped, seeded                    |
| 3   | Permissions & RBAC                         | ✅     | `resolvePermissions`/`authorize` working + default roles      |
| 4   | API Foundation & Auth                      | ✅     | Arkstack API boots; tenant-aware auth + dashboard auth routes |
| 5   | Tenants, Projects & API Keys               | 🚧     | Tenant/project/role/member/key + project-member management (audit emission deferred to Phase 9) |
| 6   | Verification Session Engine (mock e2e)     | ✅     | Public + client APIs walk a session to a decision via inline mocks; expiry + retry-limit enforced |
| 7   | Provider Packages (drivers)                | 🚧     | ocr/liveness/face-match driver packages (`mock` real, API wired via env); file storage via Arkstack `Storage` (prod analyzer drivers stubbed) |
| 8   | Workers & Async Pipeline                   | 🚧     | Postgres-backed queue + `ark queue:work`; document→ocr, complete→biometric run async to a decision (retry/backoff/dead-letter) |
| 6   | Verification Session Engine                | ⬜     | Sessions lifecycle + public/client APIs (mock providers)      |
| 7   | Provider Packages                          | ⬜     | `ocr`, `liveness`, `face-match`, `storage` drivers            |
| 8   | Workers & Async Pipeline                   | ⬜     | OCR + biometric workers process sessions to a decision        |
| 9   | Reviews & Audit Logging                    | ⬜     | Manual review workflows + full audit trail                    |
| 10  | Webhooks                                   | ⬜     | Signed, retried webhook delivery per project                  |
| 11  | TypeScript SDK                             | ⬜     | `@arkyc/sdk` server + browser launcher                        |
| 12  | Widget                                     | ⬜     | `@arkyc/widget` full verification flow                        |
| 13  | Dashboard                                  | ⬜     | Multi-tenant React Router dashboard                           |
| 14  | Playground & Docs                          | ⬜     | Example integration + documentation                           |
| 15  | Hardening & Release                        | ⬜     | Security, rate limits, retention, v0.1.0                      |

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

## Phase 5 — Tenants, Projects, Members & API Keys 🚧

**Goal:** Full multi-tenant management through the Dashboard API.

**Scope**

- [x] Tenant CRUD + tenant switching support (slug-based), `settings` JSON.
- [x] Tenant members + invitations (email + `token_hash` + expiry + accept flow).
- [x] Roles & permissions management endpoints (list/create/edit roles, assign/remove permissions, list permission catalog, system-role indicators).
- [x] Member direct permissions: view role perms / direct perms / effective perms; assign role; add/remove direct perms.
- [x] Projects CRUD with `environment`, `settings`, `branding`, project-level verification thresholds.
- [x] Project members.
- [x] API keys: create (return secret once), list, revoke; store `key_prefix` + `key_hash`; track `last_used_at`.
- [ ] All endpoints permission-gated and tenant-scoped (✅). Emit audit logs (stub sink until Phase 9, then full) — **not yet wired**.

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

## Phase 7 — Provider Packages (drivers) 🚧

**Goal:** Replace inline mocks with real driver-based provider packages.

**Scope**

- [x] **File storage** — use Arkstack's `Storage` (`@arkstack/filesystem`, flydrive-based: `put`/`getBytes`/`getUrl`/`getSignedUrl`/`exists`/`delete`; `local`/`s3`/`gcs`/`ftp` disks via `config/filesystem`) instead of a bespoke package. Captures are written private under tenant/project-scoped keys. _(No custom `packages/storage` — redundant with the framework.)_
- [x] **`packages/ocr`** — drivers `mock` (real), `tesseract` (stub), `external` (HTTP). Returns `{ fields, confidence, raw }`.
- [x] **`packages/liveness`** — drivers `mock` (real), `internal` (stub), `external` (HTTP). Returns `{ passed, score, spoofSignals, raw }`.
- [x] **`packages/face-match`** — drivers `mock` (real), `internal` (stub), `external` (HTTP). Returns `{ passed, similarityScore, confidence, raw }`.
- [x] Common driver-registry pattern (`create*Driver(config)` selects active driver; `apps/api` wires them from env, default `mock`/`local`).

_Remaining: real `tesseract`/`internal` model integrations + `s3-compatible`/`cloudflare-r2` clients (deferred to deployment)._

**Deliverables:** Four provider packages with a uniform driver interface + `mock` driver parity with Phase 6 behavior.

**Exit criteria:** Switching `OCR_DRIVER=mock|tesseract` (etc.) via config changes behavior with no call-site changes. Documents land in storage and are retrievable via signed URL.

---

## Phase 8 — Workers & Async Pipeline 🚧

**Goal:** Move heavy processing off the request path into queue workers.

**Scope**

- [x] Queue abstraction — durable **Postgres-backed** `jobs` table + `Queue` service (`enqueue`/`claim`/`complete`/`fail`), claimed atomically with `UPDATE … RETURNING` over `FOR UPDATE SKIP LOCKED`. Shared by API + the worker command.
- [x] **`ocr` queue** — consumes document jobs → runs the `ocr` driver + portrait extraction → persists results (idempotent).
- [x] **`biometric` queue** — consumes jobs → runs `face-match` + the decision engine → sets `auto_decision`/`final_decision`/`risk_score` and the final status. (Liveness stays inline — cheap check; keeps the per-session attempt limit simple.)
- [x] API enqueues jobs instead of running providers inline; `complete` moves the session to `processing` until a worker lands the decision.
- [x] Idempotency (handlers no-op on re-delivery), retries with quadratic backoff, dead-letter after max attempts, and a visibility-timeout reaper for crashed workers (at-least-once).

**Deliverables:** `ark queue:work [queue] [--once]` runnable worker command (Arkstack console; shares the app's models/DB). Run `ark queue:work ocr` and `ark queue:work biometric` as separate processes for the two roles. The empty `workers/*` scaffold packages were retired in favour of the in-app command. The session flow now completes asynchronously.

**Exit criteria:** Submitting documents/selfie enqueues work; sessions reach a decision via the worker; a reserved job from a crashed worker is reclaimed after the visibility timeout (no corruption). ✅ Covered by `tests/queue.test.ts` (claim/retry/backoff/dead-letter) + `tests/sessions.test.ts` (async walk to decision via `drain()`).

_Remaining: dedicated long-running deployment of the two `queue:work` roles (`ocr`, `biometric`); optional Redis/BullMQ backend._

---

## Phase 9 — Reviews & Audit Logging ⬜

**Goal:** Human-in-the-loop review + a complete audit trail.

**Scope**

- [ ] Review workflows: tenant/project review queues, reviewer assignment, notes.
- [ ] Actions: approve, reject, request document retry, request selfie retry, request full retry, mark suspicious, add note — each transitions status and records a `reviews` row (`previous_status`, `new_status`, `reason`, `note`) + `review_notes`.
- [ ] Dashboard API: `.../sessions/:id/{approve,reject,request-retry,notes}`, plus list/get sessions with filters (project, decision reason, status).
- [ ] **Audit logging** everywhere: tenant/project/member/role/permission/api-key/session/review/status/auth/webhook events, with `actor_id`, `actor_type`, `action`, `entity_type`, `entity_id`, `metadata`, `ip_address`, `user_agent`. `GET /v1/dashboard/tenants/:id/audit-logs`.
- [ ] Retro-fill audit emission into Phases 5–8 actions.

**Deliverables:** Reviewer endpoints + audit-log read API; every state-changing action writes an audit row.

**Exit criteria:** A `requires_review` session can be approved/rejected by a permitted reviewer, status + decision reason update correctly, and the action appears in audit logs.

---

## Phase 10 — Webhooks (`packages/webhooks`) ⬜

**Goal:** Reliable, signed event delivery per project.

**Scope**

- [ ] `packages/webhooks`: `signWebhook`, `verifyWebhookSignature`, `buildWebhookPayload`. HMAC SHA-256; headers `X-Arkyc-Signature`, `X-Arkyc-Timestamp`.
- [ ] Webhook endpoint management per project (URL, `secret_hash`, subscribed `events`, status) + test delivery.
- [ ] Emit events: `verification.{started,document_submitted,processing,requires_review,approved,rejected,completed,expired,cancelled}`.
- [ ] Delivery worker: `webhook_deliveries` with attempts, `response_status/body`, `next_retry_at`, exponential backoff retries.
- [ ] Payload matches the spec example (session/tenant/project/user_reference/checks/decision_reason).

**Deliverables:** Endpoint CRUD + test button support, delivery worker, signing utilities with verification tests.

**Exit criteria:** Completing a session POSTs a correctly-signed payload to the configured endpoint; failures retry and are visible in `webhook_deliveries`.

---

## Phase 11 — TypeScript SDK (`@arkyc/sdk`) ⬜

**Goal:** Clean DX for integrators, server + browser.

**Scope**

- [ ] **Server SDK:** `new Arkyc({ secretKey })`, `arkyc.sessions.create/retrieve/cancel`, typed responses + typed errors, webhook verification helper.
- [ ] **Browser SDK:** `@arkyc/sdk/browser` → `ArkycWidget.open({ token, onComplete })` launcher (wraps `@arkyc/widget`).
- [ ] Reuses `packages/types` for response/error shapes.
- [ ] Published build (ESM + CJS + types), versioned, with README usage examples matching the spec.

**Deliverables:** `@arkyc/sdk` package with server + browser entrypoints and tests against the API.

**Exit criteria:** The server SDK can create + fetch + cancel a session; webhook verification validates a real signed payload; the browser launcher opens the widget with a client token.

---

## Phase 12 — Widget (`@arkyc/widget`) ⬜

**Goal:** Polished, mobile-friendly embeddable verification flow.

**Scope**

- [ ] Framework-agnostic widget: `ArkycWidget.open(...)` and `ArkycWidget.mount(...)`.
- [ ] Modes: `overlay`, `inline`, `hosted`.
- [ ] Flow screens: Welcome → Document Selection → Front Capture → Back Capture → OCR Processing → Selfie Capture → Passive Liveness → Face Match → Processing → Result.
- [ ] Camera capture (document + selfie), client-side quality hints, talks only to the **Client/Widget API** with the short-lived client token.
- [ ] Customization: brand colors, logo, border radius, light/dark theme; branding sourced from project config.

**Deliverables:** `@arkyc/widget` bundle (UMD/ESM) usable standalone or via the SDK browser launcher.

**Exit criteria:** A user completes a full document + selfie verification in overlay and inline modes on mobile + desktop, themed from project branding.

---

## Phase 13 — Dashboard (`apps/dashboard`) ⬜

**Goal:** Complete multi-tenant management UI.

**Scope**

- [ ] React + React Router + shadcn/ui + Tailwind. Auth (login/register/onboarding) + tenant switching.
- [ ] Route tree from the spec: `/t/:tenantSlug/{overview,projects,projects/:id/{api-keys,webhooks},sessions,sessions/:id,reviews,audit-logs,settings,settings/roles,settings/roles/:id,settings/permissions,members,members/:id,members/:id/permissions}`.
- [ ] Pages: Overview (metrics), Tenant Settings, Role Management, Member Permissions (role/direct/effective), Projects (keys/webhooks/origins/branding/thresholds), Sessions list, Session Detail (doc images, OCR, portrait, selfie, liveness, face-match, decision, audit timeline), Review Queue (approve/reject/retry/notes + filters).
- [ ] **Permission-aware UI:** nav + action buttons render from the user's effective permissions.

**Deliverables:** Deployable dashboard consuming the Dashboard API end-to-end.

**Exit criteria:** An owner can manage tenant/projects/roles/members; a reviewer (role-limited) sees only review-relevant nav/actions and can clear the review queue.

---

## Phase 14 — Playground & Documentation ⬜

**Goal:** Prove the integrator story and document it.

**Scope**

- [ ] **`apps/playground`** — minimal example app: backend creates a session via the SDK, frontend launches the widget, displays the result, and shows a received webhook.
- [ ] **`docs/`** — getting started, architecture, multi-tenancy, RBAC, API reference (public/client/dashboard), SDK guide, widget integration, webhooks, provider drivers, self-hosting (Docker Compose), env reference.

**Deliverables:** Runnable playground + a docs site/folder covering the full integration path.

**Exit criteria:** A new developer can follow `docs/` + run the playground to complete a verification without reading source.

---

## Phase 15 — Hardening & Release (v0.1.0) ⬜

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
- **M4 — Integration surface (Phases 11–13):** SDK, widget, dashboard.
- **M5 — Ship (Phases 14–15):** playground, docs, hardening, `v0.1.0`.
