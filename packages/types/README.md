# @arkyc/types

Shared domain types and contracts for [Arkyc](https://github.com/arkstack-hq/arkyc) —
an open-source, multi-tenant identity-verification platform. Zero-runtime
TypeScript types (sessions, workflows, provider results, webhooks) plus small
pure helpers, shared across the `@arkyc/*` packages and apps.

## Install

```bash
npm install @arkyc/types
```

```ts
import type { VerificationDecision, WorkflowConfig } from '@arkyc/types'
import { workflowAddressConfig } from '@arkyc/types'
```

Docs: <https://docs.arkyc.toneflix.net>
