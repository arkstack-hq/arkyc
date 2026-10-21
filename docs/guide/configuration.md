# Configuration

Arkyc is configured via environment variables. The API reads `apps/api/.env`;
the dashboard and playground read their own `.env` files (Vite). Copy each
`.env.example` and adjust.

## API (`apps/api/.env`)

### Core

| Variable          | Example                 | Purpose                                                                                                                                        |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_NAME`        | `Arkstack`              | Application name.                                                                                                                              |
| `APP_URL`         | `http://localhost:3100` | Public base URL of the API.                                                                                                                    |
| `APP_PORT`        | `3100`                  | Port the API listens on.                                                                                                                       |
| `APP_HOST`        | `localhost`             | Bind host.                                                                                                                                     |
| `FRONTEND_URL`    | `http://localhost:3000` | Dashboard origin. Also hosts the cross-device handoff page, so the widget's QR points at `${FRONTEND_URL}/verify`.                             |
| `WEBSITE_URL`     | `http://localhost:3000` | Public website, linked from emails.                                                                                                            |
| `TRUST_PROXY`     | unset                   | Proxy hops (e.g. `1`) or subnets to trust for the client IP. Set it behind a load balancer, or device and velocity signals only see the proxy. |
| `NGROK_AUTHTOKEN` | unset                   | Optional, for exposing a local API through ngrok.                                                                                              |

### Database

| Variable       | Example                                       | Purpose                |
| -------------- | --------------------------------------------- | ---------------------- |
| `DATABASE_URL` | `postgres://arkyc:arkyc@localhost:5432/arkyc` | PostgreSQL connection. |

> Match this to your Postgres. The bundled `docker-compose.yml` provisions
> `arkyc:arkyc@localhost:5432/arkyc`.

### Auth & crypto

| Variable                    | Example                | Purpose                                                                                                                                                            |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_KEY`                   | `ark key:generate`     | Strong, stable secret. Encrypts secrets at rest and keys document fingerprints; rotating it makes existing ciphertext unreadable and restarts duplicate detection. |
| `JWT_SECRET`                | `a-long-random-secret` | Signs dashboard session JWTs.                                                                                                                                      |
| `JWT_EXPIRES_IN`            | `1h`                   | Dashboard token lifetime.                                                                                                                                          |
| `TWO_FACTOR_ENCRYPTION_KEY` | (32-byte key)          | Encrypts 2FA secrets.                                                                                                                                              |
| `CLIENT_TOKEN_TTL_SECONDS`  | `900`                  | Client-token lifetime (15 min).                                                                                                                                    |

### Providers

| Variable                                                     | Default                         | Notes                                                                              |
| ------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------- |
| `OCR_DRIVER`                                                 | `mock`                          | `mock`, `tesseract`, `ai`, or `external`.                                          |
| `LIVENESS_DRIVER` / `FACE_MATCH_DRIVER`                      | `mock`                          | `mock`, `external`, or `local`.                                                    |
| `BIOMETRICS_MODEL_DIR`                                       | `storage/models`                | Model files for the `local` drivers (`ark biometrics:setup`).                      |
| `SCREENING_DRIVER`                                           | `mock`                          | `mock`, `opensanctions`, or `external`.                                            |
| `SCREENING_API_KEY` / `SCREENING_ENDPOINT`                   | none / hosted API               | OpenSanctions key, or a yente / external endpoint.                                 |
| `SCREENING_DATASET`                                          | `default`                       | OpenSanctions dataset or collection to match against.                              |
| `SCREENING_MONITOR_INTERVAL_HOURS`                           | `24`                            | How often monitored identities are re-screened.                                    |
| `NETWORK_DRIVER`                                             | `mock`                          | `mock` or `maxmind`.                                                               |
| `MAXMIND_COUNTRY_DB` / `MAXMIND_ASN_DB`                      | none                            | GeoLite2 (or GeoIP2) database paths for `maxmind`; see [GeoIP](./providers#geoip). |
| `MAXMIND_ANONYMOUS_IP_DB` / `TOR_EXIT_LIST`                  | none                            | Optional VPN/proxy database and Tor exit list.                                     |
| `TRUST_PROXY`                                                | unset                           | Proxy hops or subnets to trust for the client IP.                                  |
| `OCR_FALLBACK_DRIVER`                                        | `mock`                          | Used when `OCR_DRIVER=ai` but a project isn't granted the `ai` capability.         |
| `OCR_LANGUAGE`                                               | `eng`                           | Tesseract language data for the `tesseract` driver.                                |
| `OCR_API_KEY`                                                | none                            | Anthropic API key for `OCR_DRIVER=ai`.                                             |
| `OCR_AI_MODEL`                                               | `claude-haiku-4-5-20251001`     | Vision model for the `ai` driver.                                                  |
| `OCR_AI_MAX_EDGE`                                            | `1568`                          | Longest uploaded image edge (px) for the `ai` driver.                              |
| `OCR_AI_TIMEOUT_MS`                                          | `30000`                         | Per-attempt timeout (ms) for the `ai` driver; raise it for large vision models.    |
| `OCR_AI_MAX_RETRIES`                                         | `2`                             | Retries for the `ai` driver on a timeout, network error, 429 or 529.               |
| `OCR_AI_PROVIDER`                                            | `anthropic`                     | `anthropic` or `workers-ai` (implied when `WORKERS_AI_MODEL` is set).              |
| `WORKERS_AI_MODEL`                                           | `@cf/google/gemma-4-26b-a4b-it` | Workers AI vision model; setting it selects the Workers AI backend.                |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`             | none                            | Workers AI credentials (token falls back to `OCR_API_KEY`).                        |
| `OCR_ENDPOINT` / `LIVENESS_ENDPOINT` / `FACE_MATCH_ENDPOINT` | none                            | `external` HTTP endpoint (or API base override for `ai`).                          |
| `LIVENESS_API_KEY` / `FACE_MATCH_API_KEY`                    | none                            | Optional bearer for the endpoint.                                                  |
| `ADDRESS_DRIVER`                                             | `mock`                          | `mock` or `live` (address stage; opt-in workflows).                                |
| `ADDRESS_ORS_API_KEY`                                        | none                            | openrouteservice key for the `live` driver's `geocode_lookup`.                     |
| `ADDRESS_ORS_URL` / `ADDRESS_NOMINATIM_URL`                  | public endpoints                | Geocoder base overrides (forward / reverse).                                       |
| `ADDRESS_USER_AGENT`                                         | `Arkyc/1.0 (…)`                 | User-Agent sent to Nominatim (per its usage policy).                               |

See [Provider drivers](./providers), [Fraud signals & screening](./fraud-signals) and [Workflows](./workflows).

### Storage

| Variable          | Default | Notes                                                                                                        |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `FILESYSTEM_DISK` | `local` | `local`, `s3`, `gcs`, or `ftp`.                                                                              |
| S3 (`s3` disk)    | none    | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_ENDPOINT`, `AWS_URL`. |
| GCS (`gcs` disk)  | none    | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_STORAGE_BUCKET`.                     |

> Any S3-compatible service works via the `s3` disk — point `AWS_ENDPOINT` at it.

### Queue

| Variable                                                          | Default         | Notes                                                                    |
| ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `QUEUE_CONNECTION`                                                | `sync`          | `sync` (inline), `database` (durable), or `redis`.                       |
| `QUEUE_TABLE`                                                     | `jobs`          | Table for the `database` connection.                                     |
| `QUEUE_RETRY_AFTER`                                               | `90`            | Seconds before a reserved job is reclaimed.                              |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_QUEUE_DB` | none            | For the `redis` connection.                                              |
| `QUEUE_NAME`                                                      | `default`       | The connection's default queue (what a worker without `--queue` drains). |
| `QUEUE_NAME_OCR`                                                  | `ocr`           | Queue for `OcrJob` (config `queue.queues.ocr`).                          |
| `QUEUE_NAME_BIOMETRIC`                                            | `biometric`     | Queue for `BiometricJob` (face match + decision).                        |
| `QUEUE_NAME_WEBHOOK`                                              | `webhook`       | Queue for `WebhookJob` (webhook delivery).                               |
| `QUEUE_NAME_MAINTENANCE`                                          | `maintenance`   | Queue for `SessionSweepJob`.                                             |
| `QUEUE_NAME_NOTIFICATIONS`                                        | `notifications` | Queue for `UserNotificationJob`.                                         |

With `database` or `redis`, every queue that receives jobs needs a worker. One
worker can work them all with `--queue='webhook,*'`. See
[Self-hosting](./self-hosting#queue-workers).

### Maintenance & cache

| Variable                 | Default    | Notes                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SWEEP_DRIVER`   | `schedule` | How expired sessions, retention and screening monitoring run: `schedule` (the framework scheduler via `ark schedule:run` from cron, or `ark schedule:work`), `queue` (a self-rescheduling job on the queue worker, started once with `ark session:sweep --loop`; needs an async queue), or `off` (expire lazily on access only). |
| `SESSION_SWEEP_INTERVAL` | `300`      | Sweep cadence in seconds (minimum 30).                                                                                                                                                                                                                                                                                           |
| `CACHE_STORE`            | `memory`   | `memory`, `file`, `redis`, or `database`.                                                                                                                                                                                                                                                                                        |

### Realtime & push

| Variable                                                                                         | Default     | Notes                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `REALTIME_TRANSPORT`                                                                             | `polling`   | `pusher`, `firebase`, `firebase-database`, `polling` (no infrastructure; clients refetch), or `memory` (tests).                  |
| `REALTIME_POLL_INTERVAL`                                                                         | `5000`      | Client refetch interval in ms for `polling`.                                                                                     |
| `REALTIME_PUSH`                                                                                  | `false`     | `firebase` to push user notifications to registered devices over FCM.                                                            |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER`                              | demo values | Pusher Channels credentials and cluster (e.g. `eu`, `us2`).                                                                      |
| `PUSHER_HOST` / `PUSHER_PORT` / `PUSHER_USE_TLS`                                                 | unset       | Point at a self-hosted soketi instead, e.g. `127.0.0.1`, `6001`, `false` for the bundled docker-compose.                         |
| `PUSHER_PUBLIC_HOST` / `PUSHER_PUBLIC_PORT` / `PUSHER_PUBLIC_USE_TLS`                            | unset       | Where browsers reach that server when it differs from `PUSHER_HOST` (inside Docker the API uses `soketi`, browsers `localhost`). |
| `FIREBASE_ADMINSDK`                                                                              | unset       | Path to the service-account JSON, instead of the three variables below.                                                          |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`                         | unset       | Service-account credentials.                                                                                                     |
| `FIREBASE_DATABASE_URL`                                                                          | unset       | Realtime Database URL for `firebase-database`.                                                                                   |
| `FIREBASE_API_KEY` / `FIREBASE_AUTH_DOMAIN` / `FIREBASE_APP_ID` / `FIREBASE_MESSAGING_SENDER_ID` | unset       | Public web config the dashboard and widget connect with.                                                                         |
| `FIREBASE_VAPID_KEY`                                                                             | unset       | Web push key for browser notifications.                                                                                          |

### Mail

`MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
`MAIL_FROM_ADDRESS`: for invitation and verification emails. In dev, a Mailpit
container on `1025` works well. `MAIL_TEST_ADDRESS` is the Arkstack mailer's test recipient.

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
