# @arkyc/screening

Driver-based watchlist screening for [Arkyc](https://github.com/arkstack-hq/arkyc), an
open-source, multi-tenant identity-verification platform. Screens an identity
against sanctions, politically exposed persons and adverse media lists; the
active driver (`mock`, `opensanctions` or `external` HTTP) is chosen by config
behind a stable result contract.

## Install

```bash
npm install @arkyc/screening
```

## Data licensing

OpenSanctions data is free for non-commercial use. Commercial use needs a
licence from OpenSanctions, whether you call the hosted API or self-host yente.

Docs: <https://docs.arkyc.toneflix.net/guide/fraud-signals>
