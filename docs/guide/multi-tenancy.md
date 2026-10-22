# Multi-tenancy

Arkyc is multi-tenant from the ground up: each tenant is an **organization**.
Every scoped table carries an `organization_id` (and a `project_id` where
relevant), and every query, storage path, and route is organization-scoped. Retrofitting isolation is explicitly avoided.

## The hierarchy

```
Organization ──< Project ──< VerificationSession ──< captures / checks / reviews
   │                │
   │                └──< ProjectMember, ApiKey, WebhookEndpoint
   └──< OrganizationMember, Role, OrganizationInvitation
```

- **Organization**: the tenant. Has a unique `slug` (used for addressing in the
  dashboard), `name`, `logo_url`, and a free-form `settings` JSON.
- **Project**: an application/environment within an organization. Carries
  `environment`, `settings`, `branding`, verification `thresholds`, and `status`.
  Slug is unique **within** the organization.
- **VerificationSession**: scoped to both `organization_id` and `project_id`.

## Verification

Every organization is treated as a business. It can build and test in
development and staging straight away, but runs production projects only once
[verified](./business-verification).

## Members

Membership is two-layered:

- **OrganizationMember**: the primary membership. One per `(organization, user)`, with a
  `role_id` and a `status` of `active` / `invited` / `suspended`. Only **active**
  members can access an organization.
- **ProjectMember**: optional, narrower scoping. One per `(project, user)`, with
  its own `role_id`. A user can belong to an organization without any project membership.

New members are added via **invitations**: an email + role + hashed token with an
expiry. Accepting the invite creates the `active` OrganizationMember. A signed-in
user with a verified email can also accept invitations addressed to them from the
dashboard's Invitations page, without the link.

## Active-organization resolution

Dashboard routes are shaped `/v1/dashboard/organizations/:organizationId/...`. The
`resolveOrganization` middleware (after auth):

1. Loads the organization by id.
2. Confirms the authenticated user is an **active** `OrganizationMember` (rejecting
   `invited`/`suspended` with `403`).
3. Attaches `req.organization` and `req.organizationMember` for downstream handlers and the
   `can(...)` permission guard.

The dashboard addresses organizations by **slug** in the URL and resolves the slug
to the organization id client-side.

## Effective permissions per request

`GET /v1/dashboard/organizations/:organizationId/me` returns the caller's `role_permissions`,
`direct_permissions`, and the deduplicated `effective_permissions` for the active
organization. The dashboard uses this to render permission-aware navigation and
actions. See [RBAC & permissions](./rbac) for how the effective set is composed.

## Isolation guarantees

- Foreign keys + indexes on `organization_id` / `project_id` on every scoped table.
- Cascade deletes from organization → projects → sessions → captures/checks.
- Storage keys are namespaced `organizations/{organizationId}/projects/{projectId}/sessions/{sessionId}/…`.
- The public/client APIs resolve organization + project from the API key / client token,
  so a key can only ever touch its own project's data.
