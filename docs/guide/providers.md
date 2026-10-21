# Provider drivers

OCR, liveness, face matching, and address verification are **driver-based**; the
active driver is chosen by config, so call sites stay provider-agnostic.

| Provider   | Drivers                               |
| ---------- | ------------------------------------- |
| OCR        | `mock`, `tesseract`, `ai`, `external` |
| Liveness   | `mock`, `external`, `local`           |
| Face match | `mock`, `external`, `local`           |
| Address    | `mock`, `live`                        |
| Screening  | `mock`, `opensanctions`, `external`   |
| Network    | `mock`, `maxmind`                     |

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
- **`local`** (liveness, face match): open models on ONNX Runtime inside the
  worker, no external provider. See [Local biometrics](#local-biometrics).

Screening and network drivers feed risk signals; see
[Fraud signals & screening](./fraud-signals).

This means production providers are integrated by **config alone**; a
self-hosted model server is just an `external` endpoint.

## Selecting drivers

Drivers are chosen from env in `apps/api/src/app/services/providers/`:

```bash
OCR_DRIVER=mock          # mock | tesseract | ai | external
LIVENESS_DRIVER=mock     # mock | external | local
FACE_MATCH_DRIVER=mock   # mock | external | local
SCREENING_DRIVER=mock    # mock | opensanctions | external
NETWORK_DRIVER=mock      # mock | maxmind
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

## Local biometrics {#local-biometrics}

`local` runs face matching and passive liveness in the API or worker process with
models whose licences allow commercial use in an MIT project:

| Model        | Use                   | Licence    |
| ------------ | --------------------- | ---------- |
| YuNet        | Face detection        | MIT        |
| SFace        | Face recognition      | Apache-2.0 |
| MiniFASNetV2 | Passive anti-spoofing | Apache-2.0 |

```bash
FACE_MATCH_DRIVER=local
LIVENESS_DRIVER=local
BIOMETRICS_MODEL_DIR=storage/models   # default

pnpm --filter @arkyc/api exec ark biometrics:setup   # download + verify the models (about 40 MB)
```

The `onnxruntime-node` and `sharp` packages must be installed (they are optional
dependencies of `@arkyc/vision`). Face match aligns both faces on five landmarks,
compares SFace embeddings by cosine similarity (same person at `0.363` and above)
and maps it to a score where the match threshold sits at `0.6`; the default
`faceMatchThreshold` of `0.75` auto-approves from a cosine of about `0.46`.
Liveness reports MiniFASNetV2's probability of a live face as the score, and flags
a second face. Active liveness also checks the challenge sequence.

Measure accuracy and latency on your own labelled pairs (`first,second,same` or
`different` per line, paths relative to the file):

```bash
pnpm --filter @arkyc/api exec ark biometrics:benchmark pairs.csv --liveness
```

Run it against the `external` drivers too (set `*_DRIVER=external`) to compare. On
an Apple M-series CPU a warm face match takes about 80 ms and a liveness check
about 30 ms.

## IP intelligence (GeoIP) {#geoip}

The `maxmind` network driver resolves the country and network owner behind a
session's IP for the [network risk signals](./fraud-signals#device-network)
(foreign or hosting networks, VPN, proxy, Tor). It reads **local** MaxMind
databases, so nothing leaves your server, but you have to put the files in place.
`NETWORK_DRIVER=mock` (the default) needs none of this.

| Database                       | Variable                  | Gives                       | Cost                   |
| ------------------------------ | ------------------------- | --------------------------- | ---------------------- |
| GeoLite2 Country               | `MAXMIND_COUNTRY_DB`      | Country of the IP           | Free (MaxMind account) |
| GeoLite2 ASN                   | `MAXMIND_ASN_DB`          | Network owner (hosting)     | Free (MaxMind account) |
| GeoIP2 Anonymous IP (optional) | `MAXMIND_ANONYMOUS_IP_DB` | VPN, proxy, hosting flags   | Commercial             |
| Tor exit list (optional)       | `TOR_EXIT_LIST`           | Tor exit nodes, one IP/line | Free                   |

### 1. Get a licence key

Create a free account at [maxmind.com](https://www.maxmind.com/en/geolite2/signup),
then **Manage License Keys → Generate new license key**. Note your **Account ID**
and the key.

### 2. Download the databases

With MaxMind's [`geoipupdate`](https://github.com/maxmind/geoipupdate) (recommended,
since it also handles updates), write a `GeoIP.conf`:

```ini
AccountID <your account id>
LicenseKey <your licence key>
EditionIDs GeoLite2-Country GeoLite2-ASN
DatabaseDirectory /var/www/api.example.com/shared/storage/geoip
```

```bash
mkdir -p /var/www/api.example.com/shared/storage/geoip
geoipupdate -f /path/to/GeoIP.conf
```

Or download each edition directly (HTTP basic auth with your Account ID and
licence key) and extract the `.mmdb`:

```bash
for edition in GeoLite2-Country GeoLite2-ASN; do
  curl -fsSL -u "$ACCOUNT_ID:$LICENSE_KEY" \
    "https://download.maxmind.com/geoip/databases/$edition/download?suffix=tar.gz" \
    | tar -xz --strip-components=1 -C storage/geoip --wildcards "*.mmdb"
done
```

Optionally, the Tor exit list:

```bash
curl -fsSL https://check.torproject.org/torbulkexitlist -o storage/geoip/tor-exit-nodes.txt
```

### 3. Configure the driver

```bash
NETWORK_DRIVER=maxmind
MAXMIND_COUNTRY_DB=storage/geoip/GeoLite2-Country.mmdb
MAXMIND_ASN_DB=storage/geoip/GeoLite2-ASN.mmdb
# MAXMIND_ANONYMOUS_IP_DB=storage/geoip/GeoIP2-Anonymous-IP.mmdb
# TOR_EXIT_LIST=storage/geoip/tor-exit-nodes.txt
```

Paths are relative to the API's working directory. In the PM2 deploy that is
`current/`, whose `storage` links to `shared/storage`, so keep the files under
**`shared/storage/geoip`** and they survive every deploy. The `maxmind` package is
an optional dependency of `@arkyc/network` and is installed by default.

Restart the API **and** the queue worker (`pm2 restart arkyc-api arkyc-worker
--update-env`). The worker runs the risk detectors, and both processes open the
databases once and keep them in memory.

### 4. Keep them current

MaxMind updates GeoLite2 twice a week, and its licence requires replacing outdated
copies. Schedule the update plus a restart, for example weekly:

```bash
# crontab -e
0 4 * * 3 geoipupdate -f /path/to/GeoIP.conf && pm2 restart arkyc-api arkyc-worker
```

If a configured database is missing or unreadable, the lookup fails, the error is
logged (`scope: network`), and the session is decided without network signals;
it does not block verification.

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

### Cloudflare Workers AI {#workers-ai}

The same driver can run on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
instead of Anthropic. Setting `WORKERS_AI_MODEL` switches the backend; set
`OCR_AI_PROVIDER=workers-ai` instead to use the default model,
`@cf/google/gemma-4-26b-a4b-it`. Any model you choose must accept image input.

```bash
OCR_DRIVER=ai
WORKERS_AI_MODEL=@cf/google/gemma-4-26b-a4b-it # the switch (or OCR_AI_PROVIDER=workers-ai)
CLOUDFLARE_ACCOUNT_ID=...                      # required
CLOUDFLARE_API_TOKEN=...                       # Workers AI token; falls back to OCR_API_KEY
```

Requests go to the account's OpenAI-compatible `/ai/v1/chat/completions`
endpoint with the same prompt and field schema, so confidence scoring and the
authenticity read below behave identically. `OCR_AI_MODEL` and `OCR_ENDPOINT`
only apply to the Anthropic backend.

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
