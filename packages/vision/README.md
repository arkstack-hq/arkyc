# @arkyc/vision

Self-hosted face detection and alignment for [Arkyc](https://github.com/arkstack-hq/arkyc),
an open-source, multi-tenant identity-verification platform. Powers the `local`
face-match and liveness drivers with ONNX Runtime and open models.

## Install

```bash
npm install @arkyc/vision onnxruntime-node sharp
```

## Models

| Model              | Use                   | Licence    |
| ------------------ | --------------------- | ---------- |
| YuNet (OpenCV Zoo) | Face detection        | MIT        |
| SFace (OpenCV Zoo) | Face recognition      | Apache-2.0 |
| MiniFASNetV2       | Passive anti-spoofing | Apache-2.0 |

Models are downloaded on demand and verified by SHA-256 (`ModelStore.ensure`).

Docs: <https://docs.arkyc.toneflix.net/guide/providers>
