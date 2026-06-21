# API reference

Arkyc exposes four surfaces, all under a global `/api` prefix:

- [**Public Project API**](./public) — your backend, authenticated with a project secret key (`sk_…`). Create and manage verification sessions.
- [**Client / Widget API**](./client) — the browser widget, authenticated with a short-lived client token. Submit captures and complete a session.
- [**Dashboard API**](./dashboard) — the management UI, authenticated with a bearer JWT and gated by [permissions](/guide/rbac).
- **Auth** — dashboard sign-in (`/v1/auth/...`), summarized on the [Dashboard API](./dashboard#auth) page.

## Base URL

```
https://<your-api-host>/api
```

In local development that's `http://localhost:3100/api`.

## Response envelope

Every response uses a consistent envelope:

```json
{
  "status": "success",
  "message": "Human-readable message",
  "code": 200,
  "data": {}
}
```

List endpoints add a pagination `meta`:

```json
{
  "status": "success",
  "code": 200,
  "data": [],
  "meta": { "current_page": 1, "per_page": 15, "total": 42 }
}
```

Errors carry the same envelope with `status: "error"`. Validation failures
(`422`) include a field-keyed `errors` object:

```json
{
  "status": "error",
  "message": "The given data was invalid.",
  "code": 422,
  "errors": { "email": ["The email field is required."] }
}
```

Common status codes: `200` OK, `201` Created, `202` Accepted, `401`
Unauthorized, `403` Permission denied, `404` Not found, `409` Conflict, `422`
Validation error.

## Authentication at a glance

| Surface         | Header                                                   |
| --------------- | -------------------------------------------------------- |
| Public Project  | `Authorization: Bearer sk_…` (or `X-Api-Key: sk_…`)      |
| Client / Widget | `X-Client-Token: <token>` (or `Authorization: Bearer …`) |
| Dashboard       | `Authorization: Bearer <jwt>`                            |

List endpoints accept a `per_page` query parameter; the Public/Client surfaces
accept `multipart/form-data` for image uploads.
