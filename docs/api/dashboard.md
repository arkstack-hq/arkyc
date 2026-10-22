# Dashboard API

The management surface used by the dashboard UI. **Auth:** `Authorization: Bearer <jwt>`.

Organization-scoped routes run through `resolveOrganization` (the caller must be an **active**
member) and a `can('…')` [permission](/guide/rbac) guard. The required permission
is listed per route below.

## Auth {#auth}

**Base:** `/api/v1/auth` (no auth unless noted).

| Method   | Path                          | Auth | Description                                 |
| -------- | ----------------------------- | ---- | ------------------------------------------- |
| `POST`   | `/v1/auth/register`           | none | Register a user; returns a bearer token.    |
| `POST`   | `/v1/auth/login`              | none | Verify credentials; issue a session token.  |
| `GET`    | `/v1/auth/me`                 | JWT  | The authenticated user.                     |
| `DELETE` | `/v1/auth/logout`             | JWT  | Revoke the current token.                   |
| `POST`   | `/v1/auth/invitations/accept` | JWT  | Accept an organization invitation by token. |
| `POST`   | `/v1/auth/forgot`             | none | Email a password-reset code.                |
| `PUT`    | `/v1/auth/forgot/:token`      | none | Consume a reset token; set a new password.  |

## Account {#account}

The signed-in user's own notifications, devices, invitations and realtime access.
**Base:** `/api/v1` · **Auth:** JWT.

| Method   | Path                                   | Description                                                                        |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`    | `/v1/account/notifications`            | Notifications, newest first (paginated; `?unread=1`), with `unread_count`.         |
| `PATCH`  | `/v1/account/notifications/:id/read`   | Mark one notification read.                                                        |
| `PATCH`  | `/v1/account/notifications/read`       | Mark all unread notifications read (or only `ids`).                                |
| `DELETE` | `/v1/account/notifications/:id`        | Delete a notification.                                                             |
| `GET`    | `/v1/account/notification-preferences` | Delivery preferences (`push`).                                                     |
| `PATCH`  | `/v1/account/notification-preferences` | Update the preferences.                                                            |
| `POST`   | `/v1/account/push-tokens`              | Register this device's push token (`token`, `platform`, `device_name`).            |
| `DELETE` | `/v1/account/push-tokens`              | Unregister this device.                                                            |
| `GET`    | `/v1/account/invitations`              | Pending invitations for the user's email (verified email required; paginated).     |
| `GET`    | `/v1/account/invitations/count`        | How many pending invitations the user has (zero until the email is verified).      |
| `PATCH`  | `/v1/account/invitations/:id/accept`   | Accept a pending invitation without the link token (verified email required).      |
| `POST`   | `/v1/realtime/auth`                    | Authorize a private realtime channel (organization, project, session or own user). |
| `GET`    | `/v1/realtime/config`                  | The realtime transport and its public connection settings.                         |

Users are notified when a session needs their review, a review is assigned to
them, someone else decides a session assigned to them, a webhook endpoint they
maintain stops delivering, and when they are invited to an organization.

## Organizations

**Base:** `/api/v1/dashboard/organizations`

| Method   | Path                                                          | Permission             | Description                                                                                                                                                   |
| -------- | ------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/organizations`                                              | none                   | List the caller's organizations (paginated).                                                                                                                  |
| `POST`   | `/organizations`                                              | none                   | Create an organization; seeds roles; caller = owner.                                                                                                          |
| `GET`    | `/organizations/:organizationId`                              | `organizations.view`   | Show the organization.                                                                                                                                        |
| `PATCH`  | `/organizations/:organizationId`                              | `organizations.update` | Update name / logo / settings.                                                                                                                                |
| `DELETE` | `/organizations/:organizationId`                              | `organizations.delete` | Permanently delete it with everything in it. Body `name` must match exactly (`422` otherwise).                                                                |
| `GET`    | `/organizations/:organizationId/verification`                 | `organizations.view`   | Business verification status, whether it can go live, and the latest submission.                                                                              |
| `POST`   | `/organizations/:organizationId/verification`                 | `organizations.update` | Submit business verification (multipart; see [Business verification](/guide/business-verification)). `201`; `409` while one is under review or once verified. |
| `GET`    | `/organizations/:organizationId/verification/documents/:kind` | `organizations.view`   | Stream an uploaded document (`incorporation` or `data_protection`).                                                                                           |

Deleting an organization also deletes every project, session, captured file,
member, role and audit log in it. The deletion is recorded in the platform audit
log, and runs on the maintenance queue.

## Members & invitations

**Base:** `/api/v1/dashboard/organizations/:organizationId`

| Method   | Path                                         | Permission       | Description                               |
| -------- | -------------------------------------------- | ---------------- | ----------------------------------------- |
| `GET`    | `/me`                                        | none             | Caller's role / direct / effective perms. |
| `GET`    | `/members`                                   | `members.view`   | List members (paginated).                 |
| `GET`    | `/members/:memberId`                         | `members.view`   | Member detail.                            |
| `PATCH`  | `/members/:memberId`                         | `members.update` | Change a member's role.                   |
| `POST`   | `/invitations`                               | `members.invite` | Invite an email with a role.              |
| `GET`    | `/members/:memberId/permissions`             | `members.view`   | Member's role / direct / effective perms. |
| `POST`   | `/members/:memberId/permissions`             | `members.update` | Grant a direct organization permission.   |
| `DELETE` | `/members/:memberId/permissions/:permission` | `members.update` | Revoke a direct permission.               |

## Projects & project members

**Base:** `/api/v1/dashboard/organizations/:organizationId/projects`

| Method   | Path                                           | Permission        | Description                                                                                        |
| -------- | ---------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `GET`    | `/projects`                                    | `projects.view`   | List projects (paginated).                                                                         |
| `POST`   | `/projects`                                    | `projects.create` | Create a project.                                                                                  |
| `GET`    | `/projects/:projectId`                         | `projects.view`   | Show a project.                                                                                    |
| `PATCH`  | `/projects/:projectId`                         | `projects.update` | Update name/status/settings/branding/thresholds.                                                   |
| `DELETE` | `/projects/:projectId`                         | `projects.delete` | Permanently delete it with its sessions, media, keys and webhooks. Body `name` must match exactly. |
| `GET`    | `/projects/:projectId/extended-access`         | `projects.view`   | Per-capability extended-access status.                                                             |
| `POST`   | `/projects/:projectId/extended-access/request` | `projects.update` | Request capabilities (`capabilities[]`, `pii`).                                                    |
| `GET`    | `/projects/:projectId/members`                 | `members.view`    | List project members.                                                                              |
| `POST`   | `/projects/:projectId/members`                 | `members.update`  | Add an organization member to the project.                                                         |
| `PATCH`  | `/projects/:projectId/members/:memberId`       | `members.update`  | Change a project member's role.                                                                    |
| `DELETE` | `/projects/:projectId/members/:memberId`       | `members.remove`  | Remove a project member.                                                                           |

A production project needs a [verified business](/guide/business-verification):
until then, creating one returns `422` on `environment`, and new projects default
to `development`. Branding starts with Arkyc's primary color.

`thresholds` takes any of `documentQualityThreshold`, `ocrConfidenceThreshold`,
`livenessThreshold`, `faceMatchThreshold`, `faceMatchRejectThreshold` and
`addressThreshold`, each a number from `0` to `1`; `null` clears an override.
`faceMatchRejectThreshold` may not exceed `faceMatchThreshold` (`422`). Unknown
keys are ignored.

## API keys

**Base:** `/api/v1/dashboard/organizations/:organizationId/projects/:projectId/api-keys`

| Method   | Path               | Permission        | Description                                 |
| -------- | ------------------ | ----------------- | ------------------------------------------- |
| `GET`    | `/api-keys`        | `api_keys.view`   | List keys (secret never returned).          |
| `POST`   | `/api-keys`        | `api_keys.create` | Mint a key; plaintext secret returned once. |
| `DELETE` | `/api-keys/:keyId` | `api_keys.revoke` | Revoke a key.                               |

## Webhooks

**Base:** `/api/v1/dashboard/organizations/:organizationId/projects/:projectId/webhooks`

| Method   | Path                        | Permission        | Description                                 |
| -------- | --------------------------- | ----------------- | ------------------------------------------- |
| `GET`    | `/webhooks`                 | `webhooks.view`   | List endpoints (secret never returned).     |
| `POST`   | `/webhooks`                 | `webhooks.create` | Register an endpoint; secret returned once. |
| `PATCH`  | `/webhooks/:webhookId`      | `webhooks.update` | Update url / events / status.               |
| `DELETE` | `/webhooks/:webhookId`      | `webhooks.delete` | Delete an endpoint.                         |
| `POST`   | `/webhooks/:webhookId/test` | `webhooks.test`   | Queue a sample delivery.                    |

See [Webhooks](/integrations/webhooks) for the payload and signature.

## Sessions & reviews

**Base:** `/api/v1/dashboard/organizations/:organizationId`

| Method  | Path                                         | Permission              | Description                                                                         |
| ------- | -------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `GET`   | `/sessions`                                  | `sessions.view`         | List sessions; filter by `status`, `decision_reason`, `project_id`.                 |
| `GET`   | `/reviews/count`                             | `reviews.view`          | How many sessions await review (for the nav badge).                                 |
| `GET`   | `/sessions/:id`                              | `sessions.view`         | Session detail, including its `risk_signals`.                                       |
| `POST`  | `/sessions/:id/approve`                      | `reviews.approve`       | Approve; optional `reason`.                                                         |
| `POST`  | `/sessions/:id/reject`                       | `reviews.reject`        | Reject; optional `reason`.                                                          |
| `POST`  | `/sessions/:id/request-retry`                | `reviews.request_retry` | Request a `kind` retry (document/selfie/full).                                      |
| `POST`  | `/sessions/:id/assign`                       | `reviews.assign`        | Assign to a reviewer (`user_id`).                                                   |
| `POST`  | `/sessions/:id/suspicious`                   | `reviews.note`          | Flag as suspicious.                                                                 |
| `POST`  | `/sessions/:id/notes`                        | `reviews.note`          | Attach a reviewer `note`.                                                           |
| `PATCH` | `/sessions/:id/risk-signals/:signalId/clear` | `reviews.approve`       | Clear a risk signal as a false positive; `reason` required, audited. Returns `201`. |

## Audit logs

| Method | Path          | Permission        | Description                                            |
| ------ | ------------- | ----------------- | ------------------------------------------------------ |
| `GET`  | `/audit-logs` | `audit_logs.view` | List audit entries; filter by `action`, `entity_type`. |

## Roles & permissions

**Base:** `/api/v1/dashboard/organizations/:organizationId`

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
organization role never grants admin access (no `resolveOrganization`).

| Method   | Path                                                 | Permission                   | Description                                                                                  |
| -------- | ---------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `GET`    | `/me`                                                | none                         | Caller's admin standing (empty for non-admins).                                              |
| `GET`    | `/settings`                                          | `admin.settings.view`        | Platform settings.                                                                           |
| `PATCH`  | `/settings`                                          | `admin.settings.update`      | Update platform settings.                                                                    |
| `GET`    | `/organizations`                                     | `admin.organizations.view`   | List organizations (paginated).                                                              |
| `GET`    | `/organizations/:organizationId`                     | `admin.organizations.view`   | Organization detail: verification, counts, session outcomes, 30-day trend, top risk signals. |
| `GET`    | `/organizations/:organizationId/projects`            | `admin.organizations.view`   | The organization's projects (paginated).                                                     |
| `GET`    | `/organizations/:organizationId/projects/:projectId` | `admin.organizations.view`   | One project in depth: configuration, counts, outcomes, access and recent sessions.           |
| `PATCH`  | `/organizations/:organizationId/verification`        | `admin.organizations.manage` | Mark an organization verified or unverified directly (`verified`).                           |
| `GET`    | `/users`                                             | `admin.users.view`           | List users (paginated).                                                                      |
| `GET`    | `/users/:userId`                                     | `admin.users.view`           | User detail.                                                                                 |
| `POST`   | `/users/:userId/admin`                               | `admin.users.manage`         | Grant platform admin.                                                                        |
| `DELETE` | `/users/:userId/admin`                               | `admin.users.manage`         | Revoke platform admin (never the last admin).                                                |
| `POST`   | `/users/:userId/status`                              | `admin.users.manage`         | Set account standing: `active`/`restricted`/`suspended`.                                     |
| `POST`   | `/users/:userId/password`                            | `admin.users.manage`         | Reset a user's password.                                                                     |
| `GET`    | `/audit-logs`                                        | `admin.audit.view`           | Platform audit log.                                                                          |

### Business verification {#admin-business-verification}

| Method  | Path                                          | Permission                   | Description                                              |
| ------- | --------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `GET`   | `/business-verifications`                     | `admin.organizations.view`   | Submissions, newest first; filter by `status`.           |
| `GET`   | `/business-verifications/count`               | `admin.organizations.view`   | Submissions awaiting review (for the nav badge).         |
| `GET`   | `/business-verifications/:id`                 | `admin.organizations.view`   | One submission with its organization.                    |
| `GET`   | `/business-verifications/:id/documents/:kind` | `admin.organizations.view`   | Stream an uploaded document.                             |
| `PATCH` | `/business-verifications/:id/approve`         | `admin.organizations.manage` | Approve (optional `note`); the organization can go live. |
| `PATCH` | `/business-verifications/:id/reject`          | `admin.organizations.manage` | Reject with a required `note` saying what to fix.        |

The organization's managers are notified of the decision. `PATCH /settings` takes
`compliance.business_verification_required` to switch the production gate off or on.

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
