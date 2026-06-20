# Arkyc

Open-source identity verification platform built on **[Arkstack](https://arkstack.toneflix.net/)** (a runtime-agnostic TypeScript backend framework) and **Arkormˣ** (its ORM).

Arkyc lets applications verify users through document capture, OCR extraction, passive liveness detection, face matching, automated decisioning, manual review workflows, webhooks, and an SDK-powered embeddable widget — all multi-tenant from the ground up.

> **Status:** early development. See **[ROADMAP.md](./ROADMAP.md)** for the phased plan. The monorepo skeleton (Phase 0) is in place; packages are stubs until their phase lands.

## Monorepo layout

```
apps/
  api/          Arkstack API (public, client/widget, and dashboard surfaces)
  dashboard/    React + React Router + shadcn/ui management UI
  playground/   Example integration app

packages/
  types/        Shared domain types (contracts)
  core/         Decision engine, status transitions, scoring (pure logic)
  auth/         Password/token/API-key/client-token helpers
  permissions/  RBAC: resolve / authorize / sync default roles & permissions
  ocr/          Driver-based OCR (mock | tesseract | external)
  liveness/     Driver-based passive liveness (mock | internal | external)
  face-match/   Driver-based face matching (mock | internal | external)
  storage/      Storage abstraction (local | s3-compatible | cloudflare-r2)
  webhooks/     Signing, verification, payload building
  sdk/          @arkyc/sdk — server + browser
  widget/       @arkyc/widget — embeddable verification flow

workers/
  ocr-worker/        Async OCR + portrait extraction
  biometric-worker/  Async liveness + face-match + decisioning

docs/           Documentation
```

## Requirements

- Node.js >= 20
- pnpm >= 10
- (optional, for local infra) Docker + Docker Compose — Postgres, MinIO (S3), Redis

## Getting started

```bash
pnpm install

# Start local infra (Postgres + MinIO + Redis)
docker compose up -d

# Copy environment template
cp .env.example .env

# Build / test / lint the whole workspace
pnpm build
pnpm test
pnpm lint
```

## Workspace scripts

Scripts fan out across the workspace with `pnpm -r` (recursive, topological order).

| Script            | Description                                  |
| ----------------- | -------------------------------------------- |
| `pnpm build`      | Build every package/app in dependency order  |
| `pnpm dev`        | Run dev tasks across the workspace            |
| `pnpm test`       | Run Vitest across packages                    |
| `pnpm lint`       | ESLint across the workspace                   |
| `pnpm typecheck`  | `tsc --noEmit` across the workspace           |
| `pnpm format`     | Prettier write                                |

## License

MIT
