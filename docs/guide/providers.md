# Provider drivers

OCR, liveness, face matching, and address verification are **driver-based**; the
active driver is chosen by config, so call sites stay provider-agnostic.

| Provider   | Drivers                               |
| ---------- | ------------------------------------- |
| OCR        | `mock`, `tesseract`, `ai`, `external` |
| Liveness   | `mock`, `external`                    |
| Face match | `mock`, `external`                    |
| Address    | `mock`, `live`                        |

- **`mock`**: deterministic, for dev and tests. Reads optional hint signals from
  the request so you can drive any outcome without a real provider.
- **`tesseract`** (OCR): real in-process OCR via Tesseract.js, fed through the
  document-parser registry (MRZ + country/document parsers). Install the optional
  `sharp` (`pnpm add sharp -F @arkyc/ocr`) for a grayscale/normalise/upscale
  preprocessing pass.
- **`ai`** (OCR): a vision LLM (Claude) reads the document and, best-effort,
  flags tamper/replay signals. See [AI OCR](#ai-ocr-driver).
- **`external`**: POSTs the image(s) to a configured HTTP endpoint and maps the
  JSON response into the provider's result shape.

This means production providers are integrated by **config alone**; a
self-hosted model server is just an `external` endpoint.

## Selecting drivers

Drivers are chosen from env in `apps/api/src/app/services/providers/`:

```bash
OCR_DRIVER=mock          # mock | tesseract | ai | external
LIVENESS_DRIVER=mock     # mock | external
FACE_MATCH_DRIVER=mock   # mock | external
```

For `external`, configure the endpoint (and optional bearer key) per provider:

```bash
OCR_DRIVER=external
OCR_ENDPOINT=https://ocr.internal/analyze
OCR_API_KEY=...

LIVENESS_DRIVER=external
LIVENESS_ENDPOINT=https://liveness.internal/check
LIVENESS_API_KEY=...

FACE_MATCH_DRIVER=external
FACE_MATCH_ENDPOINT=https://face.internal/match
FACE_MATCH_API_KEY=...
```

## AI OCR driver {#ai-ocr-driver}

`OCR_DRIVER=ai` hands the document image(s) to Anthropic's Claude vision models
and maps the structured response onto the OCR result:

```bash
OCR_DRIVER=ai
OCR_API_KEY=sk-ant-...                 # Anthropic API key (required)
OCR_AI_MODEL=claude-haiku-4-5-20251001 # optional; Haiku is the cheap default
OCR_AI_MAX_EDGE=1568                   # optional; longest uploaded edge (px)
OCR_ENDPOINT=https://api.anthropic.com # optional; gateway / proxy override
```

Install the optional `sharp` (`pnpm add sharp -F @arkyc/ocr`) to downscale uploads
to `OCR_AI_MAX_EDGE` and cut image-token cost.

**Confidence is derived, not self-reported.** LLMs are poorly calibrated, so the
OCR confidence is computed deterministically from field completeness + structural
validity; the model's own legibility read only nudges it down slightly.

**Authenticity (anti-spoofing).** The same call asks the model to assess the
document from the image alone and flag (best-effort) `screenReplay` (a photo of
a screen), `photocopy`, `digitalTampering`, and `physicalTampering`, with an
`authenticityConfidence` and short notes. This is **advisory**: a fired flag only
_caps_ the OCR confidence (so the session routes to manual review); it never
auto-rejects a user. The read is returned as `authenticity` on the OCR result and
persisted in the OCR `raw_response`.

### Fallback driver

AI processing is a **gated capability** (the `ai` capability under
[extended access](/api/dashboard#admin-ai-access)). When `OCR_DRIVER=ai` but a
project isn't granted, OCR falls back to `OCR_FALLBACK_DRIVER` (default `mock`).
Set it to a real driver in production so ungranted projects still get genuine
extraction:

```bash
OCR_DRIVER=ai
OCR_FALLBACK_DRIVER=tesseract
```

### Per-project access

AI document processing isn't on by default. It's the `ai` capability of
[extended access](/api/dashboard#admin-ai-access): project owners **request** it
from the dashboard; platform admins **grant** or **revoke** it (or grant any
project directly from the admin organization page). Until granted, a project's
sessions use the fallback driver.

## Address {#address}

The **address** stage is opt-in (custom [workflows](./workflows#address-stage)
only). Its driver corroborates the user's claimed residential address:

- **`mock`**: deterministic; honors the `address_score` / `address_passed`
  request hints, for dev and tests.
- **`live`**: real geocoding. `geocode_lookup` forward-geocodes the typed
  address via **openrouteservice**; `device_location` reverse-geocodes the
  device's GPS fix via **Nominatim** (OpenStreetMap). Each checks that the
  resolved country matches what the user entered. `poa_document` is capture-only
  and routes to manual review.

```bash
ADDRESS_DRIVER=live
ADDRESS_ORS_API_KEY=...                         # openrouteservice key (geocode_lookup)
ADDRESS_ORS_URL=https://api.openrouteservice.org/geocode/search   # optional override
ADDRESS_NOMINATIM_URL=https://nominatim.openstreetmap.org         # optional override
ADDRESS_USER_AGENT=Arkyc/1.0 (address-verification)               # optional; Nominatim policy
```

The `live` driver lives in the API (`apps/api/.../providers/address`); it's
server-only but mirrors the other drivers' factory shape. See
[Workflows → Address stage](./workflows#address-stage) for the per-workflow
methods, `on_fail`, and the `auto_approve_threshold` gate.

## Result shapes

Each `external` endpoint receives the image bytes and must return JSON matching
the provider's result type (`packages/{ocr,liveness,face-match}`):

| Provider   | Returns                                        |
| ---------- | ---------------------------------------------- |
| OCR        | `{ fields, confidence, authenticity?, raw }`   |
| Liveness   | `{ passed, score, spoofSignals, raw }`         |
| Face match | `{ passed, similarityScore, confidence, raw }` |

These feed the [decision engine](./architecture#decision-engine) along with the
project's thresholds.

## Mock hint signals

With `mock` drivers, the Client API accepts optional hints (in the multipart
body or the `complete` payload) so you can script outcomes:

- OCR: `confidence`, `expired`
- Liveness: `score`, `passed`, `multipleFaces`
- Face match: `similarityScore`, `passed`
- Address: `address_score`, `address_passed`

This is what the [playground](/guide/getting-started#_7-run-a-verification-with-the-playground)
and the widget's mock signal hints use to demonstrate the full flow without any
real provider.

## Document types & extracted fields

The widget captures four document types: `passport`, `id_card`,
`drivers_license`, and `residence_permit`. OCR reads a common set of identity
fields when present: `firstName`, `lastName`, `fullName`, `dateOfBirth`,
`documentNumber`, `expiryDate`, and `nationality`.

Which documents (and which countries or languages) actually parse, and how
accurately, is a property of the **configured OCR driver**, not Arkyc itself.
The `mock` driver returns scripted fields; `tesseract` does on-box OCR; `ai`
uses a vision model; `external` calls your own OCR service. Match the driver to
the coverage you need.

## File storage

Captured documents and selfies are written **private** via Arkstack's `Storage`.
The default disk is `local`; the `s3` disk targets AWS S3, and `gcs`/`ftp` are
available. Configure with `FILESYSTEM_DISK`
and the matching credentials; see [Configuration](./configuration).
