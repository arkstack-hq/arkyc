# @arkyc/dashboard

The Arkyc multi-tenant management dashboard — **React + React Router + TanStack
Query + Tailwind v4** with a shadcn-style component kit. A thin client over the
Dashboard API (`/v1/dashboard/...`, bearer-JWT auth).

## Develop

```bash
pnpm --filter @arkyc/dashboard dev      # vite dev server on :5173
```

API calls go to `/api` and are proxied to the local Arkstack API in dev (set
`VITE_API_PROXY`, default `http://localhost:8000`). In production the dashboard
is served alongside the API on the same origin.

```bash
pnpm --filter @arkyc/dashboard build     # vite build → dist/
pnpm --filter @arkyc/dashboard typecheck
pnpm --filter @arkyc/dashboard test
```

## Structure

- `src/lib/api.ts` — typed Dashboard API client (envelope-unwrapping, bearer token).
- `src/lib/auth.tsx` — `AuthProvider` / `useAuth` (login/register/logout, `me`).
- `src/lib/tenant.tsx` — `TenantProvider` / `useTenant` — resolves the active tenant
  by `:tenantSlug` and loads the caller's **effective permissions** (`GET .../me`).
- `src/components/ui/*` — the shadcn-style kit (button, input, card, table, dialog…).
- `src/components/Layout.tsx` — sidebar + topbar; **nav renders from permissions**.
- `src/pages/*` — one module per route.

## Routes

`/login`, `/register`, `/onboarding`, then tenant-scoped under `/t/:tenantSlug`:
`overview`, `sessions`, `sessions/:id`, `reviews`, `audit-logs`, `projects`,
`projects/:id/{api-keys,webhooks}` (+ settings), `members`, `members/:id`,
`members/:id/permissions`, `settings`, `settings/roles`, `settings/roles/:id`,
`settings/permissions`.

## Permission-aware UI

Sidebar links and action buttons render from the user's effective permissions in
the active tenant (`useTenant().can('reviews.approve')`, etc.), so a reviewer
sees only review-relevant navigation while an owner sees everything.
