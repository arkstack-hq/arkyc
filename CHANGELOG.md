# Changelog

All notable changes to Arkyc are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Phase 20 — Hardening & Release. Production-readiness pass focused on the API.

### Added

- **Rate limiting** on sensitive surfaces (auth login / 2FA / register / forgot /
  email-verify, the API-key session routes, and outbound webhook test deliveries)
  via the Express driver's IP-keyed limiter. Returns `429`; inert under test.
- **Session-expiry sweep** (`sessionService.sweepExpired`) that expires past-TTL,
  non-terminal sessions the lazy per-request refresh never reaches, firing
  `verification.expired` webhooks + realtime. Two drivers via `SESSION_SWEEP_DRIVER`:
  `schedule` (framework scheduler, default) or `queue` (self-rescheduling
  `SessionSweepJob`, no cron — start with `ark session:sweep --loop`); `off` disables.
- **Per-tenant data retention**: media-only cleanup that deletes captured images,
  selfie, liveness video, and proof-of-address image once a session is older than
  the organization's `retention_days`, keeping the session row + decision. Driven by
  the scheduler (daily) or the queue sweep; also runnable via `ark retention:purge`.
- **Webhook signing secrets encrypted at rest** (framework `Encryption`, AES-GCM
  keyed by `APP_KEY`), decrypted only at sign time; legacy plaintext rows pass
  through until the re-encrypt migration runs.
- **Per-project origin allowlist** enforced on client-token requests (opt-in: an
  empty `allowed_origins` never blocks). Disallowed browser origins get `403`
  `origin_not_allowed`.
- **Observability seams**: a vendor-neutral `reportError` (structured logging +
  pluggable external reporter) wired into the global error path and maintenance
  jobs, plus a no-op metrics sink to swap for a backend.
- Hot-path indexes on `verification_sessions` (`expires_at` for the sweep;
  `(organization_id, status)` for the review queue).

### Security

- Webhook secrets are no longer stored in plaintext.
- Audited retry limits (webhook 5, OCR 3, biometric 5, liveness attempts 3) and
  signed-asset-URL TTLs (clamped to a bounded `[min, max]`); all confirmed finite.

### Notes

- New settings: `SESSION_SWEEP_DRIVER`, `SESSION_SWEEP_INTERVAL`. `APP_KEY` now also
  derives the at-rest encryption key — set a strong, stable value; rotating it makes
  existing ciphertext unreadable.
