# Self-hosting

Arkyc runs anywhere Node, Postgres, and an S3-compatible store are available.

## Local infrastructure

The bundled `docker-compose.yml` provides everything for development:

```bash
docker compose up -d
```

| Service    | Image                | Port(s) | Credentials                   |
| ---------- | -------------------- | ------- | ----------------------------- |
| PostgreSQL | `postgres:16-alpine` | `5432`  | `arkyc` / `arkyc`, db `arkyc` |
| Redis      | `redis:7-alpine`     | `6379`  | none                          |

Uploads default to the `local` disk (`storage/app`). For object storage, point
the `s3` disk (AWS S3) or `gcs` disk at your bucket via env — see
[Configuration](./configuration).

## Migrations & seed

```bash
pnpm --filter @arkyc/api exec ark migrate          # apply all migrations
pnpm --filter @arkyc/api exec ark migrate:rollback # roll back the last batch
pnpm --filter @arkyc/api exec ark seed             # permissions + roles + demo data
```

`ark seed` runs the permission/role sync (idempotent) and the demo-tenant seeder.

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

```bash
pnpm --filter @arkyc/api exec ark queue:work database --queue=ocr
pnpm --filter @arkyc/api exec ark queue:work database --queue=biometric
pnpm --filter @arkyc/api exec ark queue:work database --queue=webhook
```

Run the roles as separate processes (use `redis` in place of `database` for the
redis connection). `--once` processes a single job and exits; `--stop-when-empty`
drains and exits (handy for cron/CI). Retries use each job's `tries`/`backoff`;
exhausted jobs run their `failed` hook. The `database` driver needs the `jobs`
table; `ark migrate` creates it.

## Production checklist

- Strong `JWT_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY`; never reuse the examples.
- `DATABASE_URL` to a managed Postgres; run `ark migrate` on deploy.
- `FILESYSTEM_DISK=s3` (or `gcs`) with private buckets and short signed-URL TTLs.
- `QUEUE_CONNECTION=database` (or `redis`) with workers supervised.
- Real provider endpoints via `*_DRIVER=external` (see [Provider drivers](./providers)).
- Per-project **allowed origins** and webhook endpoints configured.
- TLS in front of the API; restrict the dashboard origin.

> Hardening (rate limits, retention jobs, encryption-at-rest for webhook
> secrets, observability) is tracked as a dedicated release phase.
