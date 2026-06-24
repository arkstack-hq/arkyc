# Provider drivers

OCR, liveness, and face matching are **driver-based** — the active driver is
chosen by config, so call sites stay provider-agnostic.

| Provider   | Drivers                               |
| ---------- | ------------------------------------- |
| OCR        | `mock`, `tesseract`, `ai`, `external` |
| Liveness   | `mock`, `external`                    |
| Face match | `mock`, `external`                    |

- **`mock`** — deterministic, for dev and tests. Reads optional hint signals from
  the request so you can drive any outcome without a real provider.
- **`tesseract`** (OCR) — real in-process OCR via Tesseract.js, fed through the
  document-parser registry (MRZ + country/document parsers). Install the optional
  `sharp` (`pnpm add sharp -F @arkyc/ocr`) for a grayscale/normalise/upscale
  preprocessing pass.
- **`ai`** (OCR) — a vision LLM (Claude) reads the document and, best-effort,
  flags tamper/replay signals. See [AI OCR](#ai-ocr-driver).
- **`external`** — POSTs the image(s) to a configured HTTP endpoint and maps the
  JSON response into the provider's result shape.

This means production providers are integrated by **config alone** — a
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
document from the image alone and flag — best-effort — `screenReplay` (a photo of
a screen), `photocopy`, `digitalTampering`, and `physicalTampering`, with an
`authenticityConfidence` and short notes. This is **advisory**: a fired flag only
_caps_ the OCR confidence (so the session routes to manual review) — it never
auto-rejects a user. The read is returned as `authenticity` on the OCR result and
persisted in the OCR `raw_response`.

### Fallback driver

AI processing is a **gated capability**. When `OCR_DRIVER=ai` but a project isn't
granted, OCR falls back to `OCR_FALLBACK_DRIVER` (default `mock`). Set it to a
real driver in production so ungranted projects still get genuine extraction:

```bash
OCR_DRIVER=ai
OCR_FALLBACK_DRIVER=tesseract
```

### Per-project access

AI document processing isn't available to every project. Project owners
**request** access from the dashboard; platform admins **grant** or **revoke** it
(or grant any project directly from the admin organization page). Until granted, a
project's sessions use the fallback driver. See the
[admin AI-access endpoints](/api/dashboard#admin-ai-access).

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

This is what the [playground](/guide/getting-started#_7-run-a-verification-with-the-playground)
and the widget's mock signal hints use to demonstrate the full flow without any
real provider.

## File storage

Captured documents and selfies are written **private** via Arkstack's `Storage`.
The default disk is `local`; the `s3` disk is S3-compatible (AWS S3, MinIO,
Cloudflare R2), and `gcs`/`ftp` are available. Configure with `FILESYSTEM_DISK`
and the matching credentials — see [Configuration](./configuration).
