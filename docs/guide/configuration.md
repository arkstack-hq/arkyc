# Configuration

Arkyc is configured via environment variables. The API reads `apps/api/.env`;
the dashboard and playground read their own `.env` files (Vite). Copy each
`.env.example` and adjust.

## API (`apps/api/.env`)

### Core

| Variable   | Example                 | Purpose                     |
| ---------- | ----------------------- | --------------------------- |
| `APP_NAME` | `Arkstack`              | Application name.           |
| `APP_URL`  | `http://localhost:3100` | Public base URL of the API. |
| `APP_PORT` | `3100`                  | Port the API listens on.    |
| `APP_HOST` | `localhost`             | Bind host.                  |

### Database

| Variable       | Example                                       | Purpose                |
| -------------- | --------------------------------------------- | ---------------------- |
| `DATABASE_URL` | `postgres://arkyc:arkyc@localhost:5432/arkyc` | PostgreSQL connection. |

> Match this to your Postgres. The bundled `docker-compose.yml` provisions
> `arkyc:arkyc@localhost:5432/arkyc`.

### Auth & crypto

| Variable                    | Example                | Purpose                         |
| --------------------------- | ---------------------- | ------------------------------- |
| `JWT_SECRET`                | `a-long-random-secret` | Signs dashboard session JWTs.   |
| `JWT_EXPIRES_IN`            | `1h`                   | Dashboard token lifetime.       |
| `TWO_FACTOR_ENCRYPTION_KEY` | (32-byte key)          | Encrypts 2FA secrets.           |
| `CLIENT_TOKEN_TTL_SECONDS`  | `900`                  | Client-token lifetime (15 min). |

### Providers

| Variable                                                     | Default                     | Notes                                                                      |
| ------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------- |
| `OCR_DRIVER`                                                 | `mock`                      | `mock`, `tesseract`, `ai`, or `external`.                                  |
| `LIVENESS_DRIVER` / `FACE_MATCH_DRIVER`                      | `mock`                      | `mock` or `external`.                                                      |
| `OCR_FALLBACK_DRIVER`                                        | `mock`                      | Used when `OCR_DRIVER=ai` but a project isn't granted the `ai` capability. |
| `OCR_API_KEY`                                                | none                        | Anthropic API key for `OCR_DRIVER=ai`.                                     |
| `OCR_AI_MODEL`                                               | `claude-haiku-4-5-20251001` | Vision model for the `ai` driver.                                          |
| `OCR_AI_MAX_EDGE`                                            | `1568`                      | Longest uploaded image edge (px) for the `ai` driver.                      |
| `OCR_ENDPOINT` / `LIVENESS_ENDPOINT` / `FACE_MATCH_ENDPOINT` | none                        | `external` HTTP endpoint (or API base override for `ai`).                  |
| `LIVENESS_API_KEY` / `FACE_MATCH_API_KEY`                    | none                        | Optional bearer for the endpoint.                                          |
| `ADDRESS_DRIVER`                                             | `mock`                      | `mock` or `live` (address stage; opt-in workflows).                        |
| `ADDRESS_ORS_API_KEY`                                        | none                        | openrouteservice key for the `live` driver's `geocode_lookup`.             |
| `ADDRESS_ORS_URL` / `ADDRESS_NOMINATIM_URL`                  | public endpoints            | Geocoder base overrides (forward / reverse).                               |
| `ADDRESS_USER_AGENT`                                         | `Arkyc/1.0 (…)`             | User-Agent sent to Nominatim (per its usage policy).                       |

See [Provider drivers](./providers) and [Workflows](./workflows).

### Storage

| Variable          | Default | Notes                                                                                                        |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `FILESYSTEM_DISK` | `local` | `local`, `s3`, `gcs`, or `ftp`.                                                                              |
| S3 (`s3` disk)    | none    | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_ENDPOINT`, `AWS_URL`. |
| GCS (`gcs` disk)  | none    | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_STORAGE_BUCKET`.                     |

> Any S3-compatible service works via the `s3` disk — point `AWS_ENDPOINT` at it.

### Queue

| Variable                                                          | Default | Notes                                              |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------- |
| `QUEUE_CONNECTION`                                                | `sync`  | `sync` (inline), `database` (durable), or `redis`. |
| `QUEUE_TABLE`                                                     | `jobs`  | Table for the `database` connection.               |
| `QUEUE_RETRY_AFTER`                                               | `90`    | Seconds before a reserved job is reclaimed.        |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_QUEUE_DB` | none    | For the `redis` connection.                        |

With `database` or `redis`, run workers; see [Self-hosting](./self-hosting).

### Mail

`MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
`MAIL_FROM_ADDRESS`: for invitation and verification emails. In dev, a Mailpit
container on `1025` works well.

## Dashboard (`apps/dashboard/.env`)

| Variable                                                      | Example                 | Purpose                              |
| ------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| `VITE_API_ENV`                                                | `development`           | Selects which API URL below is used. |
| `VITE_DEV_API_URL`                                            | `http://localhost:3100` | API base in development.             |
| `VITE_STAGING_API_URL` / `VITE_PROD_API_URL` / `VITE_API_URL` | none                    | API base for other environments.     |

## Playground (`apps/playground/.env`)

| Variable               | Example                 | Purpose                                |
| ---------------------- | ----------------------- | -------------------------------------- |
| `ARKYC_SECRET_KEY`     | `sk_…`                  | Project secret key (server-side only). |
| `ARKYC_API_URL`        | `http://localhost:3100` | API base the playground proxies to.    |
| `ARKYC_WEBHOOK_SECRET` | (signing secret)        | Verifies received webhooks (optional). |
| `PORT`                 | `5174`                  | Playground dev-server port.            |
