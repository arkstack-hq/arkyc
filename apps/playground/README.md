# @arkyc/playground

A minimal, runnable example that exercises Arkyc end-to-end:

1. **Backend** (a Vite dev-server plugin, [`src/backend.ts`](src/backend.ts)) uses the server
   SDK `@arkyc/sdk` to open a verification session and hand its one-time **client token** to the
   browser. The project **secret key** never leaves the server.
2. **Frontend** ([`src/main.ts`](src/main.ts)) mounts the framework-agnostic `@arkyc/widget` with
   that token, walks the document + selfie flow, then shows the session's decision.
3. **Webhook receiver** (`POST /pg/webhooks/arkyc`) verifies the `X-Arkyc-Signature` and displays
   each delivered event.

The widget calls the Client API at `baseUrl: '/api'`, which Vite proxies to the real Arkyc API —
so everything is same-origin (no CORS) in dev.

## Prerequisites

- The Arkyc API (`apps/api`) running and seeded — `pnpm --filter @arkyc/api dev` (default port `3100`).
- The workspace libs built so `@arkyc/sdk` / `@arkyc/widget` resolve — `pnpm build:libs` from the repo root.
- A project **secret API key** (`sk_…`) — mint one in the dashboard (Project → API keys) or use one
  from `DemoTenantSeeder`.

## Run

```bash
cp apps/playground/.env.example apps/playground/.env
# edit .env: set ARKYC_SECRET_KEY (and ARKYC_API_URL if not :3100)

pnpm --filter @arkyc/playground dev
# open http://localhost:5174
```

Click **Start verification**, complete the widget flow, and the decision appears under **Result**.

## Local vs Remote

The **API target** toggle in the header switches which Arkyc API the playground uses — both the
widget's proxy path (`/api/local` vs `/api/remote`) and the server SDK follow it. `Local` uses
`ARKYC_API_URL` / `ARKYC_SECRET_KEY`; `Remote` uses `ARKYC_REMOTE_API_URL` / `ARKYC_REMOTE_SECRET_KEY`
(defaulting to the hosted API). A target with no secret key is shown disabled, and the selection is
remembered across reloads.

## Webhooks (optional)

To see live deliveries:

1. In the dashboard, add a webhook endpoint to your project pointing at
   `http://localhost:5174/pg/webhooks/arkyc` and subscribe to `verification.*` events.
2. Copy its signing secret into `ARKYC_WEBHOOK_SECRET` in `.env` and restart the dev server.
3. Run a verification — events arrive under **Received webhooks**, each marked `verified ✓`.

Without `ARKYC_WEBHOOK_SECRET`, deliveries are still shown but marked `unverified`.

## Env

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `ARKYC_SECRET_KEY`     | Project secret key the backend uses to create/retrieve sessions. |
| `ARKYC_API_URL`        | Arkyc API base URL (default `http://localhost:3100`).            |
| `ARKYC_WEBHOOK_SECRET` | Webhook endpoint signing secret, to verify deliveries.           |
| `PORT`                 | Playground dev-server port (default `5174`).                     |
