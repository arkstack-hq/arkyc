# @arkyc/ocr

Driver-based document OCR for [Arkyc](https://github.com/arkstack-hq/arkyc) — an
open-source, multi-tenant identity-verification platform. The active driver
(`mock`, `tesseract`, `ai` / Claude vision, or `external` HTTP) is chosen by
config, so call sites stay provider-agnostic. Includes MRZ + country/document
parsers.

## Install

```bash
npm install @arkyc/ocr
```

Docs: <https://docs.arkyc.toneflix.net/guide/providers>
