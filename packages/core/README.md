# @arkyc/core

The deterministic decision engine for [Arkyc](https://github.com/arkstack-hq/arkyc) —
an open-source, multi-tenant identity-verification platform. Turns verification
signals (document, OCR, liveness, face match, address) into a risk score and an
`approved` / `requires_review` / `rejected` verdict, plus the session status
machine and threshold resolution.

## Install

```bash
npm install @arkyc/core
```

```ts
import { DecisionEngine } from '@arkyc/core'

const { decision, reason, riskScore } = DecisionEngine.decide(signals, thresholds)
```

Pure and side-effect-free, so the same logic runs in the API and in tests.

Docs: <https://docs.arkyc.toneflix.net/guide/architecture>
