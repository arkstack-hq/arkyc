# Testing your integration

You can drive a full verification end to end without any real biometrics or
provider. The **`mock`** provider drivers are deterministic and read optional
**signal hints**, so you can script an `approved`, `rejected`, or
`requires_review` outcome on demand and assert your webhook and result handling
against each.

## Enable the mock drivers

The mock drivers are the default in development. Set them explicitly in your API
environment if needed:

```bash
OCR_DRIVER=mock
LIVENESS_DRIVER=mock
FACE_MATCH_DRIVER=mock
ADDRESS_DRIVER=mock
```

See [Provider drivers](/guide/providers) for what each driver does and how to
swap in a real one for production.

## Script an outcome with signal hints

The widget (and the Client API) accept an optional `signals` object that the
mock drivers use to decide the result. Pass it on `open` / `mount`:

```ts
ArkycWidget.open({
  token: clientToken,
  signals: { expired: true }, // force a DOCUMENT_EXPIRED rejection
})
```

The hints and the outcome they produce:

| Hint                | Type      | Effect                                            |
| ------------------- | --------- | ------------------------------------------------- |
| `quality_score`     | `number`  | Document image quality in `[0, 1]`.               |
| `ocr_confidence`    | `number`  | OCR confidence in `[0, 1]`; low routes to review. |
| `expired`           | `boolean` | `true` fails the document as `DOCUMENT_EXPIRED`.  |
| `liveness_score`    | `number`  | Passive-liveness score in `[0, 1]`.               |
| `liveness_passed`   | `boolean` | `false` fails liveness as `LIVENESS_FAILED`.      |
| `multiple_faces`    | `boolean` | `true` triggers `MULTIPLE_FACES_DETECTED`.        |
| `face_similarity`   | `number`  | Selfie-to-portrait similarity in `[0, 1]`.        |
| `face_match_passed` | `boolean` | `false` fails face match as `FACE_MATCH_FAILED`.  |
| `address_score`     | `number`  | Address-match score in `[0, 1]`.                  |
| `address_passed`    | `boolean` | `false` fails the address stage.                  |

Rules of thumb for each decision:

- **Approved:** omit the hints (the mock defaults pass) or send high scores with
  `expired: false`.
- **Rejected:** send a hard failure, for example `expired: true`,
  `liveness_passed: false`, `face_match_passed: false`, or `multiple_faces: true`.
- **Requires review:** send a mid or low score that is below the pass threshold
  but not an outright failure (for example `ocr_confidence: 0.6` or
  `face_similarity: 0.6`), which yields a `*_LOW_CONFIDENCE` reason.

See [Verification lifecycle](/guide/verification-lifecycle) for the full status
and `decision_reason` taxonomy.

::: warning Mock only
Signal hints are honored by the `mock` drivers only. Real drivers (`tesseract`,
`ai`, `external`, `live`) ignore them and compute their own result, so leave the
hints out of production code.
:::

## Run the whole flow locally

The [playground](/guide/getting-started#_7-run-a-verification-with-the-playground)
(`apps/playground`) creates a session against your local API and mounts the
widget, so you can walk a real capture flow end to end and watch the live events
and final decision land.

## Test webhooks

- **From the dashboard:** open **Project → Webhooks**, pick an endpoint, and
  **send a test delivery**. Every attempt is recorded in the deliveries log,
  where you can inspect the payload and replay it.
- **Locally:** point an endpoint at a tunnel (such as a local forwarding tool)
  and verify the signature exactly as in production. See
  [Webhooks](/integrations/webhooks#handling-deliveries-safely) for verification
  and the idempotency rules your handler should follow.
