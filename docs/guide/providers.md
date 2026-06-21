# Provider drivers

OCR, liveness, and face matching are **driver-based**. Each ships two drivers:

- **`mock`** — deterministic, for dev and tests. Reads optional hint signals from
  the request so you can drive any outcome without a real provider.
- **`external`** — POSTs the image(s) to a configured HTTP endpoint and maps the
  JSON response into the provider's result shape.

This means production providers are integrated by **config alone** — a
self-hosted model server is just an `external` endpoint.

## Selecting drivers

Drivers are chosen from env in `apps/api/src/app/services/providers/`:

```bash
OCR_DRIVER=mock          # mock | external
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

## Result shapes

Each `external` endpoint receives the image bytes and must return JSON matching
the provider's result type (`packages/{ocr,liveness,face-match}`):

| Provider   | Returns                                        |
| ---------- | ---------------------------------------------- |
| OCR        | `{ fields, confidence, raw }`                  |
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
