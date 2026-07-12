# Contributing to Arkyc

Thanks for your interest in improving Arkyc. This guide covers local setup, the
day-to-day workflow, and the conventions the codebase follows.

## Prerequisites

- **Node.js** >= 20
- **pnpm** 10.28.2 (`corepack enable` picks up the pinned `packageManager`)
- **PostgreSQL** (the API integration tests need a real database)

## Setup

```bash
pnpm install
pnpm run build:libs        # build the workspace libraries (apps import their dist/)
```

Configure the API environment:

```bash
cp apps/api/.env.example apps/api/.env
# set DATABASE_URL and a strong APP_KEY, then run migrations
cd apps/api && pnpm ark migrate
```

`APP_KEY` signs tokens and derives the at-rest encryption key — set a strong, stable
value (`ark key:generate`).

## Running things

```bash
pnpm run dev               # run the API (apps/api)
pnpm run play              # run the example playground app
pnpm --filter @arkyc/dashboard dev
```

Background work runs through the durable queue; process it with
`cd apps/api && pnpm ark queue:work database --queue=ocr,biometric,webhook,maintenance`.
Scheduled maintenance runs via `ark schedule:work` (dev) or a `schedule:run` cron.

## Quality gates

Run these before opening a PR — CI runs the same:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test              # API tests need Postgres + migrations applied
```

Prefer scoping while iterating, e.g. `pnpm --filter @arkyc/api test` or
`pnpm --filter @arkyc/widget test`.

## Repository layout

See the monorepo map in [README.md](./README.md). In short: `apps/*` are runnable
apps (API, dashboard, playground) and `packages/*` are the shared libraries
(`types`, `core`, `auth`, `permissions`, driver packages, `webhooks`, `sdk`,
`widget`). Cross-package changes usually start in `packages/types` (the contracts);
rebuild libs after editing them so consumers pick up the new `dist/`.

## Conventions

- **Commits** follow Conventional Commits: `feat(scope): …`, `fix(scope): …`,
  `docs: …`, `chore: …`, `build: …`, `refactor: …`.
- **Imports** use extensionless relative paths (no `.js`).
- **Data changes** go through migrations in `apps/api/src/database/migrations`
  (`ark make:migration`); keep them idempotent where practical.
- **New API errors** are added to `ApiErrorKey` in `packages/types` first, then to
  the `API_ERRORS` catalog — the two are kept in lockstep by the type.
- Add or update tests alongside behavior changes; keep `lint`, `typecheck`, and
  `test` green.

## Pull requests

Open a PR against `main` with a clear description of the change and its rationale.
Keep PRs focused, and note any new environment variables, settings, or migrations
in the description (and in [CHANGELOG.md](./CHANGELOG.md) under _Unreleased_).

## Security

Please do not open public issues for vulnerabilities. Report them privately to the
maintainers so a fix can ship before disclosure.
