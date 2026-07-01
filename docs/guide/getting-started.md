# Getting started

This guide takes you from a fresh clone to a completed verification: local infra,
the API, the dashboard, and the playground.

## Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- **Docker** + Docker Compose (for Postgres, MinIO, Redis)

## 1. Install

```bash
git clone <your-fork> arkyc && cd arkyc
pnpm install
```

## 2. Start local infrastructure

The repo ships a Compose file with Postgres, MinIO (S3-compatible), and Redis:

```bash
docker compose up -d
```

| Service    | Port(s)       | Credentials                                  |
| ---------- | ------------- | -------------------------------------------- |
| PostgreSQL | `5432`        | user `arkyc` · password `arkyc` · db `arkyc` |
| MinIO      | `9000`/`9001` | user `arkyc` · password `arkyc-secret`       |
| Redis      | `6379`        | none                                         |

## 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` to match the Compose Postgres, and a real `JWT_SECRET`:

```bash
DATABASE_URL="postgres://arkyc:arkyc@localhost:5432/arkyc"
APP_PORT=3100
JWT_SECRET="a-long-random-secret"
```

See [Configuration](./configuration) for every variable. By default the OCR,
liveness, and face-match providers run as deterministic **mocks**, so you can
complete a verification end-to-end with no external services.

## 4. Migrate and seed

```bash
# from apps/api
pnpm --filter @arkyc/api exec ark migrate
pnpm --filter @arkyc/api exec ark seed
```

`ark migrate` runs all migrations; `ark seed` syncs the permission catalogue and
default roles, then creates a demo tenant with projects, members, and fixture
sessions. The seeded owner user has the password `password` (its email is
random; check the `users` table, or just register your own account in step 6).

## 5. Run the API

```bash
pnpm --filter @arkyc/api dev      # ark dev, http://localhost:3100
```

Because providers default to `mock` and the queue defaults to `sync`, no worker
process is required for local development. (For the durable queue, set
`QUEUE_CONNECTION=database` and run `ark queue:work`; see
[Self-hosting](./self-hosting).)

## 6. Run the dashboard

```bash
cp apps/dashboard/.env.example apps/dashboard/.env   # VITE_DEV_API_URL defaults to :3100
pnpm --filter @arkyc/dashboard dev                    # http://localhost:5173
```

Register an account, create an **organization** (tenant), then a **project**.
In the project, mint an **API key** (`sk_…`); you'll see the secret once.

## 7. Run a verification with the playground

The playground creates a session server-side via the SDK, runs the widget, and
shows the decision + any webhooks.

```bash
cp apps/playground/.env.example apps/playground/.env
# set ARKYC_SECRET_KEY=sk_… (from step 6)
pnpm --filter @arkyc/playground dev                   # http://localhost:5174
```

Open the playground, click **Start verification**, and complete the document +
selfie flow. With mock providers the session lands on a decision immediately.

To see webhooks, add an endpoint in the dashboard (Project → Webhooks) pointing
at `http://localhost:5174/pg/webhooks/arkyc`, copy its signing secret into
`ARKYC_WEBHOOK_SECRET`, and restart the playground.

## What next?

- [Architecture](./architecture): how the pieces fit together.
- [API reference](/api/): the public, client, and dashboard surfaces.
- [Server SDK](/integrations/sdk) · [Widget](/integrations/widget) · [Webhooks](/integrations/webhooks).
