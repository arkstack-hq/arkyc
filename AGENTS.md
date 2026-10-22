# Arkyc - agent guide

Backend is built on **Arkstack** with `arkormx`, `resora`, `musket`/`ark`, the Express driver, and Postgres.

This file is a guide for agents working in this repository. Keep it limited to current architecture, conventions, invariants, and sharp edges that affect how code should be written. Product requirements and status belong in `ROADMAP.md`. Do not turn this file into a progress log or implementation history.

## Comments

Separate setup, validation, actions, and return statements with blank lines when they are distinct logical blocks.

Comments should be simple guides to what a utility (variable, function, class, block) does at it's current state, not what changed, what could break if it was implemented in a certain way way or lines of baby sitting instructions. If a utility does not need a comment, do not add one, and when added, keep it concise and straight to the point. Summary, comments should be usefull and short or not exist at all.

## Core rules

- Do not commit untill there is an explicit instruction to do so.
- Run `pnpm check` before every commit. Commit incrementally and keep each commit gate-green.
- No credits of any kind in commit messages, pull request descriptions or release notes: no AI attribution, no `Co-Authored-By` trailers, no "Generated with" footers.
- Do not `git push` unless asked.
- Work on a new branch, never directly on `main`, and give each feature its own commit. Do not fold unrelated feature implementations into a single commit.
- Stage only files relevant to the requested change.
- Never run `tsc -b`; it emits JavaScript into `src/`. Use `pnpm typecheck` or `pnpm check`.
- Prefer existing domain abstractions over parallel implementations. If a policy already has one authority, extend that authority rather than duplicating it in a controller, resource, or job.
- Every potentially unbounded database result must be paginated or processed in bounded batches.
- Do not implement joins, counts, audiences, or exports by loading unbounded models and filtering in application code.
- Prefer OOP whenever possible and only go procedural for small features and where OOP totally makes no sense.

## Commands

| Task                                   | Command                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| Typecheck                              | `pnpm typecheck`                                             |
| Full gate                              | `pnpm check`                                                 |
| Unit tests                             | `pnpm test`                                                  |
| Apply migration (API)                  | `pnpm ark migrate <migration_basename>` / `pnpm ark migrate` |
| Seed (API)                             | `pnpm ark seed <SeederName>` / `pnpm ark seed`               |
| Regenerate Arkstack types/config (API) | `pnpm prepare`                                               |

## Database and migrations (apps/api)

- Development uses `arkyc`; integration tests use `arkyc_test`, create if not exist.
- Apply new migrations to both databases. Use `ark migrate`; never edit migration checksums manually.
- `src/database/migrations` remains outside automatic formatting so checksums stay stable.
- Common SchemaBuilder forms include `table.id(...).primary()`, `table.enum`, `table.json`, `table.text`, `table.timestamps`, `.map('snake_case')`, foreign keys, and indexes.
- Single-column unique constraints belong on the column with `.unique()`. `table.unique([...])` is for composite uniqueness.
- To modifiy a column definition, construct the new definition in a migration file and end the chain with `.change()`
- Seeders extend `Seeder`, are registered in `DatabaseSeeder`, and must be idempotent. Prefer `upsert` or row-level `updateOrCreate`; do not use destructive synchronization for seeded pivots.
- Postgres `date` values may round-trip as JavaScript `Date` objects and shift by timezone. For calendar-day semantics, store/compare a date string or compare in SQL as appropriate.
- Postgres needs the `pgvector` extension; `face_embeddings` has a dimensionless `vector` column and is read and written only through `FaceEmbeddingStore` with raw SQL.
- `DB.raw(sql, bindings)` binds `?` placeholders by quoting values into the SQL. Never use `$1` style, and pass dates as ISO strings.
- In `alterTable`, index columns are physical names except columns added in the same block (`table.index(['ipAddress', 'created_at'])`). In `createTable`, `.unique()` goes before `.foreign()` in a column chain.

## ArkORM query conventions (apps/api)

- Prefer static shortcuts such as `Model.where`, `Model.create`, and `Model.firstOrFail`. Use `Model.query()` when the chain needs query-only operations such as scopes.
- Use `query.when(condition, callback)` for conditional clauses.
- Use object ordering: `orderBy({ col: 'asc' })`.
- Use object/callback where clauses: `where({ col: value })` or grouped callbacks. `whereLike` receives the raw search term, without `%` wrappers.
- Prefer `.firstOrFail()` for model lookup 404s. Use explicit request guards for validation that is not a failed model lookup.
- JSON fields need model casts. When creating an array-valued JSON field, serialize it if required to prevent Postgres array handling.
- Custom tables use `static override table = '...'`.
- Prefer model relationships and ArkORM helpers over rebuilding morph predicates or raw SQL.
- For camelCase morph attributes mapped to snake_case columns, pass the model attribute names explicitly to `morphTo`.
- Prefer `whereHas`, `whereDoesntHave`, `whereExists`, `whereColumn`, aggregates, date helpers, and `inRandomOrder` before raw SQL.
- A bounded result that combines relationship filters with counts may use `loadCount` after retrieval when the adapter cannot compile the aggregate cleanly.
- Do not rely on model-query joins inside `whereExists` where ArkORM cannot compile them. Use a documented raw `exists` only when supported relation APIs cannot express the query.
- `belongsToMany` pivot keys must use physical database column names such as `role_id`, not camelCase model attributes.
- Do not use `orWhere('col', null)` as a null predicate. It compiles to `= NULL` and cannot match null rows.
- `query.update(data)` updates a single row and returns one model. Use `query.updateFrom(data)` to update every matching row.
- Relation filters may be grouped (`where((q) => q.whereHas(...).orWhereHas(...))`) and nested (`whereHas` inside a `whereHas` callback); both compile to SQL on arkormx >= 2.12.12. Check unfamiliar relation filters with `query.toSql()`.

## Controllers, routes, validation, and resources (apps/api)

- Controllers extend `BaseController`.
- Snapshot or validate controller body data before the first `await`. Router controller instances are reused, so reading mutable controller request fields after an await is unsafe.
- Use `this.validate(rules, true)` when validated keys should be camelized.
- Never combine a nullable array with wildcard rules such as `field.*`; validate optional array entries during normalization instead.
- The authenticated account is `req.user!`.
- Client API routes authenticate with `clientTokenAuth`, which accepts device tokens only and sets `req.verificationSession`. Launch and handoff tokens are single-use and only work on `POST /v1/client/claim`; issue and check them through `ClientTokenService`.
- Route files under `src/routes/` are auto-loaded. A route without `[auth]` is probably public.
- Paginate with `.paginate(perPage(req.query))` whenever result size is not strictly bounded for finegrained control replace `perPage` with `resolvePagination`.
- Use domain services only for shared logic or real orchestration. Do not create thin one-caller service classes around a model query.
- POST is for creation and normally returns 201. State transitions should generally use PATCH and return 201. GET and DELETE return 200 under the current router behavior.

### Resora (apps/api)

- Named resources own substantial API contracts. Use `GenericResource` only for small one-off payloads.
- Resource collections use `collects = XResource` and asynchronous serialization with `toObjectAsync()`.
- Never switch collections to synchronous `toObject()` when nested serializers can be async.
- Nest relations through their resource collections.
- If a model field collides with a Resora internal, read it through `this.resource.<field>`.
- Be careful with a top-level resource field named `data`: Resora can unwrap it. Build the response envelope manually where the payload itself legitimately contains `data`.

## Configuration and feature flags

- New nested config keys require `pnpm prepare` so `.arkstack/ark.d.ts` and build output are updated.
- The API consumes workspace packages from their `dist`. After changing anything under `packages/`, run `pnpm build:libs` before testing the API.
- In console commands, `Logger.success(msg, true)` exits the process, so only the last message may pass `true`. Musket reads commas in an argument description as allowed choices.

## Risk signals (apps/api)

- `RiskSignalService` is the single place that runs detectors, applies the workflow policy (`RiskSignals.applyPolicy`) and stores signals. Add a fraud check as a `RiskDetector` in `src/app/services/risk/detectors` and register it there; never decide in a controller or job.
- Signals default to review. A signal rejects only when a workflow's `risk_policy` (or the screening stage's `on_hit`) says so; advisory and review-only signals never reject.
- Duplicate matching compares sessions with different, non-null `user_reference`s only, and uses `Fingerprints` (HMAC keyed from `APP_KEY`). Never store or compare raw document numbers.
- Device signals skip private and loopback IPs, which is what every request looks like behind a proxy without `TRUST_PROXY`.
- Tests pin `SCREENING_DRIVER` and `NETWORK_DRIVER` to `mock` in `vitest.config.ts`; the mock OCR's identity is fixed unless a test sends `full_name`, `date_of_birth` or `document_number` hints, so give each session a distinct identity when duplicates would interfere.

## Business verification and deletion (apps/api)

- `BusinessVerificationService` is the one authority for the production gate: `canGoLive` for project creation and `assertCanVerify` inside session creation. Don't re-check organization verification elsewhere.
- Tests that create a `production` project directly must give its organization `verificationStatus: 'verified'`; API-created projects in unverified organizations default to `development`.
- Delete projects and organizations through `DeletionService` (via `DeletionJob`): it purges stored media in bounded batches before the row delete cascades. Never delete those rows directly.

## Realtime, notifications and push

- Realtime runs on Arkstack: `Broadcast` from `@arkstack/notifications` on the API, `@arkstack/realtime` in the dashboard and widget. The transport is env-driven (`REALTIME_TRANSPORT`); do not add transport code to Arkyc.
- Build channel names with `realtimeChannels` from `@arkyc/types` (dot-separated segments). Every private channel needs a `Broadcast.channel` rule in `src/routes/realtime.ts`; the widget authorizes as its `VerificationSession`, dashboard users as their `User`.
- Broadcast domain events with `broadcastSafely` from `src/support/realtime-channels.ts`, after the owning write, so a transport failure never fails the operation.
- Tests run with `REALTIME_TRANSPORT=memory`; assert on `MemoryRealtimeDriver.broadcasts()`.
- Emit application notifications through `NotificationEvent`. Set recipients, actor, action/subject context, then call `.dispatchSafely()` only after the owning write succeeds.
- Never notify the actor about their own action unless the domain explicitly requires it.
- User realtime notifications use authenticated `private-user.<id>` channels only.
- Push delivery is best-effort and must not fail the primary operation or notification job. Respect `notifications.push`, send to registered devices, and remove invalid tokens reported by the transport.

## Project documentation boundaries

- `AGENTS.md`: current architecture, conventions, invariants, and sharp edges for agents.
- `ROADMAP.md`: product requirements and their checkbox state.
- `LAUNCH_VERIFICATION.md`: verification requiring deployed infrastructure, devices, real traffic, provider accounts, DNS/certificates, or outside parties.
- Keep implementation history, completed-work narratives, and bug postmortems out of this guide unless the resulting constraint cannot be understood without a very short explanation.

## Testing

Not everything requires coverage.

- Skip writting tests for small/minor regression/bug fixes.
- Do not write tests for small features that are part of a larger feature that has coverage touching.
- Skip writting tests for small changes to existing features.
