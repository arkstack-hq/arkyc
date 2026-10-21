# Fraud signals & screening

The checks on a session (document quality, OCR confidence, liveness, face match,
address) judge that session alone. **Risk signals** look further: across the
organization's other sessions, at the network the user came from, at the document
itself, and at sanctions and PEP watchlists. Signals feed the same decision
engine, are stored per session, and are visible to reviewers, webhooks and the SDK.

## How signals decide a session

Every signal has a **key**, a **severity** (`info`, `review` or `reject`), a
contribution to the risk score, and evidence. The decision engine keeps its fixed
precedence:

1. The built-in hard rejections (expired document, failed liveness or face match,
   a failed address on a `reject` workflow).
2. Signals with severity `reject`.
3. The built-in review triggers (low quality, low confidence, multiple faces, address).
4. Signals with severity `review`.
5. Otherwise the session is approved.

When several signals share a severity, the most serious decides the reason:
sanctions, underage, duplicate document, duplicate face, tampering, inconsistent
document, PEP, adverse media, duplicate identity, risky network, IP country
mismatch, velocity.

Each non-informational signal also raises `risk_score`, and a rejecting one
floors it at `0.9`.

| Signal                  | Decision reason       | Raised when                                                                             |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `duplicate_document`    | `DUPLICATE_DOCUMENT`  | The document was used before in the organization under a different `user_reference`.    |
| `duplicate_identity`    | `DUPLICATE_IDENTITY`  | The same name and date of birth appear under a different `user_reference`.              |
| `duplicate_face`        | `DUPLICATE_FACE`      | The selfie matches a face stored for another `user_reference` (opt-in).                 |
| `document_tampering`    | `DOCUMENT_TAMPERING`  | The `ai` OCR driver flagged a screen replay, photocopy or edit. Advisory.               |
| `document_inconsistent` | `DOCUMENT_TAMPERING`  | MRZ check digits fail, the MRZ disagrees with the visual zone, or dates are impossible. |
| `sanctions_match`       | `SANCTIONS_MATCH`     | Screening matched a sanctions list.                                                     |
| `pep_match`             | `PEP_MATCH`           | Screening matched a politically exposed person.                                         |
| `adverse_media`         | `ADVERSE_MEDIA_MATCH` | Screening matched a crime, warning or debarment list.                                   |
| `high_risk_network`     | `HIGH_RISK_DEVICE`    | The claiming IP is a VPN, Tor exit, proxy or hosting provider.                          |
| `ip_country_mismatch`   | `HIGH_RISK_DEVICE`    | The IP country differs from the document nationality.                                   |
| `velocity_exceeded`     | `VELOCITY_EXCEEDED`   | One IP opened more sessions than the project allows.                                    |
| `underage`              | `UNDERAGE`            | The holder is younger than the workflow's `min_age`.                                    |

## Signal policy

Signals send a session to **review** by default; none rejects unless the
organization opts in. A workflow sets a policy per signal in
`options.risk_policy`:

```json
{
  "options": {
    "min_age": 18,
    "risk_policy": { "duplicate_document": "reject", "ip_country_mismatch": "ignore" }
  }
}
```

In the dashboard's workflow editor this is the **Fraud signals** card: pick
**Balanced** (everything to review, the default), **Strict** (reject reused
documents, duplicate faces and underage holders), **Relaxed** (ignore the IP
country, repeat session and same name signals), or **Custom** to choose per
signal, grouped by category.

`ignore` keeps the signal on the session as information only. Some signals are
capped at review whatever the policy says: `duplicate_identity` and
`ip_country_mismatch` (too weak to reject on), and advisory signals such as the
`ai` driver's tampering read. Sanctions hits follow the screening stage's `on_hit`
instead.

## Duplicate detection

When a session is decided, Arkyc stores two **fingerprints**: a keyed HMAC of the
issuing country, document type and document number, and one of the normalized
name and date of birth. The key is derived from `APP_KEY`, raw numbers are never
stored or compared, and fingerprints survive media retention. Rotating `APP_KEY`
starts duplicate detection afresh.

A match only counts against a session with a **different** `user_reference`, so
pass a stable reference for each end user. Sessions without one are fingerprinted
but never flagged.

### Face duplicates (opt-in)

An organization can turn on **duplicate face detection** in Settings. Arkyc then
stores an embedding of each selfie (with `pgvector`) and searches the
organization's embeddings for the same face under another user reference.
Embeddings expire after the configured retention (365 days by default) and are
purged with media retention. They are biometric templates under GDPR Article 9
and laws like BIPA, so make sure you have a lawful basis and consent before
enabling this. It needs a face-match driver that can embed (`local` or `mock`).

## Device & network

When the widget claims its device token, Arkyc records the client IP and user
agent. At decision time:

- **Velocity**: more than `max_sessions` sessions from one IP, under other user
  references, within `window_minutes` raises `velocity_exceeded`. Set the limits
  per project (Settings → Session velocity); the default is 5 per hour.
- **Network**: the `NETWORK_DRIVER` looks the IP up. The `maxmind` driver reads
  local GeoLite2 Country and ASN databases, recognizes hosting providers from the
  ASN owner, takes VPN and proxy flags from the commercial GeoIP2 Anonymous IP
  database when present, and Tor exits from `TOR_EXIT_LIST`. See
  [IP intelligence (GeoIP)](./providers#geoip) to download and configure the
  databases.

Private and loopback addresses are skipped. Behind a load balancer set
`TRUST_PROXY` (for example `1`) or every request looks like the proxy.

## Document checks

These run on every OCR result, with no extra provider:

- MRZ check digits (document number, birth date, expiry).
- The MRZ against the visual zone, when a country parser reads the visual zone.
- Impossible dates: issued after expiry, born after issue or in the future, older
  than 120 years.
- `min_age` from the workflow against the extracted date of birth.

## Watchlist screening

Add the **screening** stage to a workflow to screen the extracted name, date of
birth, nationality and document number:

```json
{ "key": "screening", "enabled": true, "config": { "threshold": 0.7, "on_hit": "review", "monitor": true } }
```

- `threshold`: the minimum match score in `[0, 1]`.
- `on_hit`: what a **sanctions** hit does, `review` or `reject`. PEP and adverse
  media hits follow the risk policy.
- `monitor`: keep re-screening the identity after the session completes.

Screening needs OCR, so it doesn't run with `skip_ocr`. If the provider fails, the
session goes to review with an advisory `sanctions_match` marked `unavailable`
rather than passing unscreened.

| Driver          | Notes                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `mock`          | A fictional watchlist: `Ivan Sanctionov` (sanctions) and `Paula Politico` (PEP).                  |
| `opensanctions` | The hosted OpenSanctions API (`SCREENING_API_KEY`) or a self-hosted yente (`SCREENING_ENDPOINT`). |
| `external`      | POSTs `{ subject, threshold }` and expects `{ hits }`.                                            |

OpenSanctions data is free for non-commercial use; commercial use needs a licence
from OpenSanctions, whichever way you reach it.

A hit notifies the project's reviewers. On the session page reviewers see each
hit next to the extracted identity and can **clear** a false positive with a
reason; clearing is recorded in the audit log.

### Ongoing monitoring

Sessions in a workflow with `monitor: true` are re-screened every
`SCREENING_MONITOR_INTERVAL_HOURS` (24 by default) while they stay approved or in
review. A new entity raises a signal on the session, notifies reviewers and sends
a `verification.screening_alert` webhook. Monitoring runs on the same drivers as
the session sweep (scheduler or queue), or on demand with `ark screening:monitor`.

## Where signals appear

- **Dashboard**: the session page lists every signal with its evidence.
- **Webhooks**: `checks.risk` carries the score and each signal's key, severity and
  whether it was cleared; `checks.screening.hits` carries uncleared watchlist hits.
- **SDK**: `WebhookEvent`, `WebhookChecks`, `WebhookRiskCheck` and `ScreeningHit`
  are exported, and `arkyc.webhooks.constructEvent()` verifies and parses a payload.
