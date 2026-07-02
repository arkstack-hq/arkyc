# Dashboard API

The management surface used by the dashboard UI. **Auth:** `Authorization: Bearer <jwt>`.

Tenant-scoped routes run through `resolveTenant` (the caller must be an **active**
member) and a `can('…')` [permission](/guide/rbac) guard. The required permission
is listed per route below.

## Auth {#auth}

**Base:** `/api/v1/auth` (no auth unless noted).

| Method   | Path                          | Auth | Description                                |
| -------- | ----------------------------- | ---- | ------------------------------------------ |
| `POST`   | `/v1/auth/register`           | none | Register a user; returns a bearer token.   |
| `POST`   | `/v1/auth/login`              | none | Verify credentials; issue a session token. |
| `GET`    | `/v1/auth/me`                 | JWT  | The authenticated user.                    |
| `DELETE` | `/v1/auth/logout`             | JWT  | Revoke the current token.                  |
| `POST`   | `/v1/auth/invitations/accept` | JWT  | Accept a tenant invitation by token.       |
| `POST`   | `/v1/auth/forgot`             | none | Email a password-reset code.               |
| `PUT`    | `/v1/auth/forgot/:token`      | none | Consume a reset token; set a new password. |

## Tenants

**Base:** `/api/v1/dashboard/tenants`

| Method  | Path                 | Permission       | Description                                   |
| ------- | -------------------- | ---------------- | --------------------------------------------- |
| `GET`   | `/tenants`           | none             | List the caller's tenants (paginated).        |
| `POST`  | `/tenants`           | none             | Create a tenant; seeds roles; caller = owner. |
| `GET`   | `/tenants/:tenantId` | `tenants.view`   | Show the tenant.                              |
| `PATCH` | `/tenants/:tenantId` | `tenants.update` | Update name / logo / settings.                |

## Members & invitations

**Base:** `/api/v1/dashboard/tenants/:tenantId`

| Method   | Path                                         | Permission       | Description                               |
| -------- | -------------------------------------------- | ---------------- | ----------------------------------------- |
| `GET`    | `/me`                                        | none             | Caller's role / direct / effective perms. |
| `GET`    | `/members`                                   | `members.view`   | List members (paginated).                 |
| `GET`    | `/members/:memberId`                         | `members.view`   | Member detail.                            |
| `PATCH`  | `/members/:memberId`                         | `members.update` | Change a member's role.                   |
| `POST`   | `/invitations`                               | `members.invite` | Invite an email with a role.              |
| `GET`    | `/members/:memberId/permissions`             | `members.view`   | Member's role / direct / effective perms. |
| `POST`   | `/members/:memberId/permissions`             | `members.update` | Grant a direct tenant permission.         |
| `DELETE` | `/members/:memberId/permissions/:permission` | `members.update` | Revoke a direct permission.               |

## Projects & project members

**Base:** `/api/v1/dashboard/tenants/:tenantId/projects`

| Method   | Path                                           | Permission        | Description                                      |
| -------- | ---------------------------------------------- | ----------------- | ------------------------------------------------ |
| `GET`    | `/projects`                                    | `projects.view`   | List projects (paginated).                       |
| `POST`   | `/projects`                                    | `projects.create` | Create a project.                                |
| `GET`    | `/projects/:projectId`                         | `projects.view`   | Show a project.                                  |
| `PATCH`  | `/projects/:projectId`                         | `projects.update` | Update name/status/settings/branding/thresholds. |
| `GET`    | `/projects/:projectId/extended-access`         | `projects.view`   | Per-capability extended-access status.           |
| `POST`   | `/projects/:projectId/extended-access/request` | `projects.update` | Request capabilities (`capabilities[]`, `pii`).  |
| `GET`    | `/projects/:projectId/members`                 | `members.view`    | List project members.                            |
| `POST`   | `/projects/:projectId/members`                 | `members.update`  | Add a tenant member to the project.              |
| `PATCH`  | `/projects/:projectId/members/:memberId`       | `members.update`  | Change a project member's role.                  |
| `DELETE` | `/projects/:projectId/members/:memberId`       | `members.remove`  | Remove a project member.                         |

## API keys

**Base:** `/api/v1/dashboard/tenants/:tenantId/projects/:projectId/api-keys`

| Method   | Path               | Permission        | Description                                 |
| -------- | ------------------ | ----------------- | ------------------------------------------- |
| `GET`    | `/api-keys`        | `api_keys.view`   | List keys (secret never returned).          |
| `POST`   | `/api-keys`        | `api_keys.create` | Mint a key; plaintext secret returned once. |
| `DELETE` | `/api-keys/:keyId` | `api_keys.revoke` | Revoke a key.                               |

## Webhooks

**Base:** `/api/v1/dashboard/tenants/:tenantId/projects/:projectId/webhooks`

| Method   | Path                        | Permission        | Description                                 |
| -------- | --------------------------- | ----------------- | ------------------------------------------- |
| `GET`    | `/webhooks`                 | `webhooks.view`   | List endpoints (secret never returned).     |
| `POST`   | `/webhooks`                 | `webhooks.create` | Register an endpoint; secret returned once. |
| `PATCH`  | `/webhooks/:webhookId`      | `webhooks.update` | Update url / events / status.               |
| `DELETE` | `/webhooks/:webhookId`      | `webhooks.delete` | Delete an endpoint.                         |
| `POST`   | `/webhooks/:webhookId/test` | `webhooks.test`   | Queue a sample delivery.                    |

See [Webhooks](/integrations/webhooks) for the payload and signature.

## Sessions & reviews

**Base:** `/api/v1/dashboard/tenants/:tenantId`

| Method | Path                          | Permission              | Description                                                         |
| ------ | ----------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `GET`  | `/sessions`                   | `sessions.view`         | List sessions; filter by `status`, `decision_reason`, `project_id`. |
| `GET`  | `/sessions/:id`               | `sessions.view`         | Session detail.                                                     |
| `POST` | `/sessions/:id/approve`       | `reviews.approve`       | Approve; optional `reason`.                                         |
| `POST` | `/sessions/:id/reject`        | `reviews.reject`        | Reject; optional `reason`.                                          |
| `POST` | `/sessions/:id/request-retry` | `reviews.request_retry` | Request a `kind` retry (document/selfie/full).                      |
| `POST` | `/sessions/:id/assign`        | `reviews.assign`        | Assign to a reviewer (`user_id`).                                   |
| `POST` | `/sessions/:id/suspicious`    | `reviews.note`          | Flag as suspicious.                                                 |
| `POST` | `/sessions/:id/notes`         | `reviews.note`          | Attach a reviewer `note`.                                           |

## Audit logs

| Method | Path          | Permission        | Description                                            |
| ------ | ------------- | ----------------- | ------------------------------------------------------ |
| `GET`  | `/audit-logs` | `audit_logs.view` | List audit entries; filter by `action`, `entity_type`. |

## Roles & permissions

**Base:** `/api/v1/dashboard/tenants/:tenantId`

| Method  | Path             | Permission        | Description                                 |
| ------- | ---------------- | ----------------- | ------------------------------------------- |
| `GET`   | `/permissions`   | `settings.view`   | The permission catalogue, grouped.          |
| `GET`   | `/roles`         | `settings.view`   | List roles (paginated).                     |
| `POST`  | `/roles`         | `settings.update` | Create a custom role with permissions.      |
| `GET`   | `/roles/:roleId` | `settings.view`   | Show a role with its permission names.      |
| `PATCH` | `/roles/:roleId` | `settings.update` | Update a role's name / description / perms. |

## Admin (platform) {#admin}

**Base:** `/api/v1/admin`, `Authorization: Bearer <jwt>` plus a platform
`canAdmin('…')` permission. This surface sits **above** organizations; an
organization role never grants admin access (no `resolveTenant`).

| Method   | Path                                      | Permission                 | Description                                              |
| -------- | ----------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `GET`    | `/me`                                     | none                       | Caller's admin standing (empty for non-admins).          |
| `GET`    | `/settings`                               | `admin.settings.view`      | Platform settings.                                       |
| `PATCH`  | `/settings`                               | `admin.settings.update`    | Update platform settings.                                |
| `GET`    | `/organizations`                          | `admin.organizations.view` | List organizations (paginated).                          |
| `GET`    | `/organizations/:organizationId`          | `admin.organizations.view` | Organization detail + counts.                            |
| `GET`    | `/organizations/:organizationId/projects` | `admin.organizations.view` | The organization's projects (paginated).                 |
| `GET`    | `/users`                                  | `admin.users.view`         | List users (paginated).                                  |
| `GET`    | `/users/:userId`                          | `admin.users.view`         | User detail.                                             |
| `POST`   | `/users/:userId/admin`                    | `admin.users.manage`       | Grant platform admin.                                    |
| `DELETE` | `/users/:userId/admin`                    | `admin.users.manage`       | Revoke platform admin (never the last admin).            |
| `POST`   | `/users/:userId/status`                   | `admin.users.manage`       | Set account standing: `active`/`restricted`/`suspended`. |
| `POST`   | `/users/:userId/password`                 | `admin.users.manage`       | Reset a user's password.                                 |
| `GET`    | `/audit-logs`                             | `admin.audit.view`         | Platform audit log.                                      |

### Extended access {#admin-ai-access}

Gate project **capabilities** per project. The registry currently defines `ai`
(the [AI OCR driver](/guide/providers#ai-ocr-driver)) and `pii` (reading the
extracted identity/address data back). Each capability is a separate
request/grant, so an admin can approve one and leave another pending. Project
owners request capabilities (under [Projects](#projects-project-members)); admins
list, review, grant, and revoke here.

| Method | Path                                   | Permission                     | Description                                       |
| ------ | -------------------------------------- | ------------------------------ | ------------------------------------------------- |
| `GET`  | `/extended-access`                     | `admin.extended_access.view`   | List grants; filter by `status`/`capability`.     |
| `GET`  | `/extended-access/count`               | `admin.extended_access.view`   | Count of pending requests (for the nav badge).    |
| `GET`  | `/extended-access/projects/:projectId` | `admin.extended_access.view`   | A project's grants across every capability.       |
| `POST` | `/extended-access/grant`               | `admin.extended_access.manage` | Grant a capability (`project_id`, `capability`).  |
| `POST` | `/extended-access/revoke`              | `admin.extended_access.manage` | Revoke a capability (`project_id`, `capability`). |

A PII request carries `pii: { categories: ["identity","address"], timing:
"before" | "after", justification }`. Once granted, the extracted data is read
**only** through the server SDK's `sessions.retrieve()` (secret key); it is never
sent to the browser widget or included in webhooks. See
[Extracted PII](/integrations/sdk#extracted-pii).
