# Dashboard API

The management surface used by the dashboard UI. **Auth:** `Authorization: Bearer <jwt>`.

Tenant-scoped routes run through `resolveTenant` (the caller must be an **active**
member) and a `can('…')` [permission](/guide/rbac) guard. The required permission
is listed per route below.

## Auth {#auth}

**Base:** `/api/v1/auth` — no auth unless noted.

| Method   | Path                          | Auth | Description                                |
| -------- | ----------------------------- | ---- | ------------------------------------------ |
| `POST`   | `/v1/auth/register`           | —    | Register a user; returns a bearer token.   |
| `POST`   | `/v1/auth/login`              | —    | Verify credentials; issue a session token. |
| `GET`    | `/v1/auth/me`                 | JWT  | The authenticated user.                    |
| `DELETE` | `/v1/auth/logout`             | JWT  | Revoke the current token.                  |
| `POST`   | `/v1/auth/invitations/accept` | JWT  | Accept a tenant invitation by token.       |
| `POST`   | `/v1/auth/forgot`             | —    | Email a password-reset code.               |
| `PUT`    | `/v1/auth/forgot/:token`      | —    | Consume a reset token; set a new password. |

## Tenants

**Base:** `/api/v1/dashboard/tenants`

| Method  | Path                 | Permission       | Description                                   |
| ------- | -------------------- | ---------------- | --------------------------------------------- |
| `GET`   | `/tenants`           | —                | List the caller's tenants (paginated).        |
| `POST`  | `/tenants`           | —                | Create a tenant; seeds roles; caller = owner. |
| `GET`   | `/tenants/:tenantId` | `tenants.view`   | Show the tenant.                              |
| `PATCH` | `/tenants/:tenantId` | `tenants.update` | Update name / logo / settings.                |

## Members & invitations

**Base:** `/api/v1/dashboard/tenants/:tenantId`

| Method   | Path                                         | Permission       | Description                               |
| -------- | -------------------------------------------- | ---------------- | ----------------------------------------- |
| `GET`    | `/me`                                        | —                | Caller's role / direct / effective perms. |
| `GET`    | `/members`                                   | `members.view`   | List members (paginated).                 |
| `GET`    | `/members/:memberId`                         | `members.view`   | Member detail.                            |
| `PATCH`  | `/members/:memberId`                         | `members.update` | Change a member's role.                   |
| `POST`   | `/invitations`                               | `members.invite` | Invite an email with a role.              |
| `GET`    | `/members/:memberId/permissions`             | `members.view`   | Member's role / direct / effective perms. |
| `POST`   | `/members/:memberId/permissions`             | `members.update` | Grant a direct tenant permission.         |
| `DELETE` | `/members/:memberId/permissions/:permission` | `members.update` | Revoke a direct permission.               |

## Projects & project members

**Base:** `/api/v1/dashboard/tenants/:tenantId/projects`

| Method   | Path                                     | Permission        | Description                                      |
| -------- | ---------------------------------------- | ----------------- | ------------------------------------------------ |
| `GET`    | `/projects`                              | `projects.view`   | List projects (paginated).                       |
| `POST`   | `/projects`                              | `projects.create` | Create a project.                                |
| `GET`    | `/projects/:projectId`                   | `projects.view`   | Show a project.                                  |
| `PATCH`  | `/projects/:projectId`                   | `projects.update` | Update name/status/settings/branding/thresholds. |
| `GET`    | `/projects/:projectId/members`           | `members.view`    | List project members.                            |
| `POST`   | `/projects/:projectId/members`           | `members.update`  | Add a tenant member to the project.              |
| `PATCH`  | `/projects/:projectId/members/:memberId` | `members.update`  | Change a project member's role.                  |
| `DELETE` | `/projects/:projectId/members/:memberId` | `members.remove`  | Remove a project member.                         |

## API keys

**Base:** `/api/v1/dashboard/tenants/:tenantId/projects/:projectId/api-keys`

| Method   | Path               | Permission        | Description                                  |
| -------- | ------------------ | ----------------- | -------------------------------------------- |
| `GET`    | `/api-keys`        | `api_keys.view`   | List keys (secret never returned).           |
| `POST`   | `/api-keys`        | `api_keys.create` | Mint a key — plaintext secret returned once. |
| `DELETE` | `/api-keys/:keyId` | `api_keys.revoke` | Revoke a key.                                |

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
