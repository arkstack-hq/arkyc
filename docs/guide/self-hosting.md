# Self-hosting

Arkyc runs anywhere Node, Postgres, and an S3-compatible store are available.

## Local infrastructure

The bundled `docker-compose.yml` provides everything for development:

```bash
docker compose up -d
```

| Service    | Image                    | Port(s) | Credentials                   |
| ---------- | ------------------------ | ------- | ----------------------------- |
| PostgreSQL | `pgvector/pgvector:pg16` | `5432`  | `arkyc` / `arkyc`, db `arkyc` |
| Redis      | `redis:7-alpine`         | `6379`  | none                          |

Uploads default to the `local` disk (`storage/app`). For object storage, point
the `s3` disk (AWS S3) or `gcs` disk at your bucket via env — see
[Configuration](./configuration).

## Migrations & seed

```bash
pnpm --filter @arkyc/api exec ark migrate          # apply all migrations
pnpm --filter @arkyc/api exec ark migrate:rollback # roll back the last batch
pnpm --filter @arkyc/api exec ark seed             # permissions + roles + demo data
```

`ark seed` runs the permission/role sync (idempotent) and the demo-organization seeder.

## Running the services

```bash
# API
pnpm --filter @arkyc/api build && pnpm --filter @arkyc/api start   # or: ark dev

# Dashboard (static SPA)
pnpm --filter @arkyc/dashboard build   # outputs dist/, serve behind any static host
```

Put the dashboard behind the same origin as the API (or set its `VITE_*_API_URL`
to the API's public URL) and ensure each project's **allowed origins** include the
dashboard/widget host.

## Queue workers

For production, use the durable queue and run workers as long-lived processes:

```bash
QUEUE_CONNECTION=database   # in apps/api/.env
```

Jobs are dispatched onto five queues, each named by config (`queue.queues.*`, set
via `QUEUE_NAME_*`). **Every queue that receives jobs needs a worker that works
it**, or those jobs wait forever: sessions stall in `processing` and webhooks are
never delivered. Note that a worker with no `--queue` drains only the connection's
`default` queue, which none of Arkyc's jobs use by default.

`--queue` takes one queue, a comma-separated **priority list** (each loop takes the
first job found walking the list), or `*` for **every** queue (needs
`@arkstack/queue` 0.19.6+). Quote `*` in a shell, or zsh/bash may expand it.

| Queue (`QUEUE_NAME_*`)     | Default         | Jobs                                      |
| -------------------------- | --------------- | ----------------------------------------- |
| `QUEUE_NAME_OCR`           | `ocr`           | `OcrJob`: OCR + portrait extraction       |
| `QUEUE_NAME_BIOMETRIC`     | `biometric`     | `BiometricJob`: face match + decision     |
| `QUEUE_NAME_WEBHOOK`       | `webhook`       | `WebhookJob`: signed webhook delivery     |
| `QUEUE_NAME_MAINTENANCE`   | `maintenance`   | `SessionSweepJob`: expiry + retention     |
| `QUEUE_NAME_NOTIFICATIONS` | `notifications` | `UserNotificationJob`: user notifications |

Pick one of two layouts.

**One worker per queue** (isolates slow OCR/biometric work from webhook delivery):

```bash
pnpm --filter @arkyc/api exec ark queue:work database --queue=ocr
pnpm --filter @arkyc/api exec ark queue:work database --queue=biometric
pnpm --filter @arkyc/api exec ark queue:work database --queue=webhook
pnpm --filter @arkyc/api exec ark queue:work database --queue=maintenance
pnpm --filter @arkyc/api exec ark queue:work database --queue=notifications
```

**A single worker** (for a resource-limited host) works every queue, webhook
deliveries first. This is what the bundled PM2 config (`ecosystem.config.cjs`)
runs:

```bash
pnpm --filter @arkyc/api exec ark queue:work database '--queue=webhook,*'
```

`*` also picks up jobs left on any queue name, so nothing needs draining after
changing `QUEUE_NAME_*`. (The older single-worker setup, every `QUEUE_NAME_*` set to
`default` and a bare `ark queue:work`, still works. But jobs already waiting on the
old names then need a one-off `--queue=<name> --stop-when-empty` drain.)

Use `redis` in place of `database` for the redis connection. `--once` processes a
single job and exits; `--stop-when-empty` drains and exits (handy for cron/CI). Retries use each job's `tries`/`backoff`;
exhausted jobs run their `failed` hook. The `database` driver needs the `jobs`
table; `ark migrate` creates it.

## Production checklist

- Strong `JWT_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY`; never reuse the examples.
- `DATABASE_URL` to a managed Postgres; run `ark migrate` on deploy.
- `FILESYSTEM_DISK=s3` (or `gcs`) with private buckets and short signed-URL TTLs.
- `QUEUE_CONNECTION=database` (or `redis`) with supervised workers covering
  **every** queue: one per queue, or a single `--queue=webhook,*` worker (see
  [Queue workers](#queue-workers)).
- Real provider endpoints via `*_DRIVER=external` (see [Provider drivers](./providers)).
- Postgres with the **pgvector** extension available (`ark migrate` enables it for
  face embeddings). Managed Postgres on most providers offers it; for a local
  install, build pgvector against your server's `pg_config`.
- `TRUST_PROXY` set when the API sits behind a load balancer, so device and
  velocity signals see the client IP.
- For self-hosted biometrics, `FACE_MATCH_DRIVER=local` / `LIVENESS_DRIVER=local`
  and `ark biometrics:setup` on each worker (see [Provider drivers](./providers#local-biometrics)).
- A screening data licence if you screen commercially (see [Fraud signals](./fraud-signals#watchlist-screening)).
- Per-project **allowed origins** and webhook endpoints configured.
- TLS in front of the API; restrict the dashboard origin.

> Hardening (rate limits, retention jobs, encryption-at-rest for webhook
> secrets, observability) is tracked as a dedicated release phase.
