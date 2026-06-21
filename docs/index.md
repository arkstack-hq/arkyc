---
layout: home

hero:
  name: Arkyc
  text: Open-source identity verification
  tagline: Multi-tenant document + biometric verification — capture, OCR, liveness, face match, decisioning, reviews, webhooks, SDK and embeddable widget.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: Architecture
      link: /guide/architecture

features:
  - title: Multi-tenant from day one
    details: Every table, query, storage path, and route is tenant- and project-scoped. Tenants → projects → sessions, with role-based access control per tenant.
  - title: Driver-based providers
    details: OCR, liveness, and face match each ship a deterministic `mock` driver plus an `external` HTTP driver — swap real providers by config alone.
  - title: Async verification pipeline
    details: A Postgres-backed job queue runs OCR and biometric work off the request path, driving each session to an automated decision (approved / requires_review / rejected).
  - title: Human-in-the-loop reviews
    details: A review queue with approve / reject / retry / assign / note, plus a full audit trail of every tenant-scoped action.
  - title: Signed webhooks
    details: HMAC-SHA256 signed delivery per project, with retries and a deliveries log. Verify in one call with `@arkyc/sdk`.
  - title: SDK + widget
    details: A typed server SDK creates sessions; the framework-agnostic widget runs the capture flow in overlay, inline, or hosted mode.
---
