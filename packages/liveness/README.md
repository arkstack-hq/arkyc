# @arkyc/liveness

Driver-based passive liveness detection for
[Arkyc](https://github.com/arkstack-hq/arkyc) — an open-source, multi-tenant
identity-verification platform. The active driver (`mock` or `external` HTTP) is
chosen by config behind a stable result contract, so a self-hosted model server
is just an `external` endpoint.

## Install

```bash
npm install @arkyc/liveness
```

Docs: <https://docs.arkyc.toneflix.net/guide/providers>
