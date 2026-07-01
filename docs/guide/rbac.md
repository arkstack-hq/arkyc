# RBAC & permissions

Access control lives in `packages/permissions`: pure resolution logic behind
store ports, with an Arkormˣ-backed implementation in the API. Permissions are
flat strings grouped by domain; roles bundle permissions; users get the union of
their role permissions plus any direct grants.

## Permission catalogue

Permissions are `group.action` strings. The full catalogue:

| Group        | Permissions                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `tenants`    | `tenants.view`, `tenants.update`, `tenants.delete`                                                             |
| `members`    | `members.view`, `members.invite`, `members.update`, `members.remove`                                           |
| `projects`   | `projects.view`, `projects.create`, `projects.update`, `projects.delete`                                       |
| `api_keys`   | `api_keys.view`, `api_keys.create`, `api_keys.revoke`                                                          |
| `webhooks`   | `webhooks.view`, `webhooks.create`, `webhooks.update`, `webhooks.delete`, `webhooks.test`                      |
| `sessions`   | `sessions.view`, `sessions.create`, `sessions.cancel`, `sessions.retry`, `sessions.export`                     |
| `reviews`    | `reviews.view`, `reviews.assign`, `reviews.approve`, `reviews.reject`, `reviews.request_retry`, `reviews.note` |
| `audit_logs` | `audit_logs.view`                                                                                              |
| `settings`   | `settings.view`, `settings.update`                                                                             |
| `billing`    | `billing.view`, `billing.update`                                                                               |

`PermissionSync.permissions(store)` upserts the whole catalogue idempotently
(run on seed / boot).

## Default system roles

Five system roles are created per tenant by `PermissionSync.roles(tenantId, store)`:

| Role      | Slug        | Permissions                                                                                                                               |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Owner     | `owner`     | The entire catalogue.                                                                                                                     |
| Admin     | `admin`     | Everything **except** `tenants.delete` and `billing.update`.                                                                              |
| Reviewer  | `reviewer`  | `sessions.view` + all `reviews.*` (view/assign/approve/reject/request_retry/note).                                                        |
| Developer | `developer` | Integration: `projects.view`, all `api_keys.*`, all `webhooks.*`, `sessions.view`, `sessions.create`, `audit_logs.view`, `settings.view`. |
| Read-only | `readonly`  | Every `*.view` permission across the catalogue.                                                                                           |

System roles are marked `is_system` and are read-only in the dashboard. Tenants
can also create custom roles with any permission subset.

## How effective permissions resolve

`Permissions.resolve({ userId, tenantId, projectId? }, store)` returns the
**deduplicated union** of four sources:

1. **Tenant role** permissions (the user's `TenantMember.role`).
2. **Project role** permissions (the user's `ProjectMember.role`, when `projectId` is given).
3. **Direct tenant grants**: `user_permissions` rows with `project_id IS NULL`.
4. **Direct project grants**: `user_permissions` rows with `project_id = projectId`.

```
effective = dedupe(tenantRole ∪ projectRole ∪ directTenant ∪ directProject)
```

There is **no precedence ordering and no negative permissions**; direct grants
only _add_ to role permissions; they can't revoke. Resolution is pure; the API
provides an `ArkormPermissionStore` that eager-loads the joins (no N+1).

## Enforcement

- `hasPermission(perms, 'sessions.view')` (+ `hasAny` / `hasAll` / `ensurePermission`) for in-code checks.
- `authorize(ctx, permission, store)` throws `PermissionDeniedError` (`403`).
- In the API, the `can('sessions.view')` middleware factory gates routes; it runs
  after `auth` + `resolveTenant`. The required permission for each route is listed
  in the [Dashboard API reference](/api/dashboard).
