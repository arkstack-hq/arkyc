# Multi-tenancy

Arkyc is multi-tenant from the ground up. Every scoped table carries a
`tenant_id` (and a `project_id` where relevant), and every query, storage path,
and route is tenant-scoped. Retrofitting isolation is explicitly avoided.

## The hierarchy

```
Tenant ──< Project ──< VerificationSession ──< captures / checks / reviews
   │           │
   │           └──< ProjectMember, ApiKey, WebhookEndpoint
   └──< TenantMember, Role, TenantInvitation
```

- **Tenant** — an organization. Has a unique `slug` (used for addressing in the
  dashboard), `name`, `logo_url`, and a free-form `settings` JSON.
- **Project** — an application/environment within a tenant. Carries
  `environment`, `settings`, `branding`, verification `thresholds`, and `status`.
  Slug is unique **within** the tenant.
- **VerificationSession** — scoped to both `tenant_id` and `project_id`.

## Members

Membership is two-layered:

- **TenantMember** — the primary membership. One per `(tenant, user)`, with a
  `role_id` and a `status` of `active` / `invited` / `suspended`. Only **active**
  members can access a tenant.
- **ProjectMember** — optional, narrower scoping. One per `(project, user)`, with
  its own `role_id`. A user can belong to a tenant without any project membership.

New members are added via **invitations**: an email + role + hashed token with an
expiry. Accepting the invite creates the `active` TenantMember.

## Active-tenant resolution

Dashboard routes are shaped `/v1/dashboard/tenants/:tenantId/...`. The
`resolveTenant` middleware (after auth):

1. Loads the tenant by id.
2. Confirms the authenticated user is an **active** `TenantMember` (rejecting
   `invited`/`suspended` with `403`).
3. Attaches `req.tenant` and `req.tenantMember` for downstream handlers and the
   `can(...)` permission guard.

The dashboard addresses tenants by **slug** in the URL and resolves the slug to
the tenant id client-side.

## Effective permissions per request

`GET /v1/dashboard/tenants/:tenantId/me` returns the caller's `role_permissions`,
`direct_permissions`, and the deduplicated `effective_permissions` for the active
tenant. The dashboard uses this to render permission-aware navigation and
actions. See [RBAC & permissions](./rbac) for how the effective set is composed.

## Isolation guarantees

- Foreign keys + indexes on `tenant_id` / `project_id` on every scoped table.
- Cascade deletes from tenant → projects → sessions → captures/checks.
- Storage keys are namespaced `tenants/{tenantId}/projects/{projectId}/sessions/{sessionId}/…`.
- The public/client APIs resolve tenant + project from the API key / client token,
  so a key can only ever touch its own project's data.
