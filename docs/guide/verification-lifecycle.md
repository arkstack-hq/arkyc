# Verification lifecycle & results

Every verification is one **session** that moves through a lifecycle and ends on
a **decision**. This page is the reference for the statuses a session can hold,
how they map to a decision, the reasons behind a decision, and the result data
you read back (via the [SDK](/integrations/sdk), the
[Public API](/api/public), or [webhooks](/integrations/webhooks)).

## Session statuses

A session's `status` is its lifecycle state. Progress statuses advance as the
user completes each step; the flow then settles on a terminal status (or waits
in `requires_review` for a human).

| `status`             | Terminal? | Meaning                                                                  |
| -------------------- | --------- | ------------------------------------------------------------------------ |
| `pending`            | no        | Session created; the client token is minted but the user hasn't started. |
| `started`            | no        | The user opened the widget and began the flow.                           |
| `document_submitted` | no        | Document image(s) uploaded.                                              |
| `address_submitted`  | no        | Address step completed (only if the workflow includes it).               |
| `liveness_submitted` | no        | Selfie / liveness captured.                                              |
| `processing`         | no        | Running OCR, liveness, face match, and the decision engine.              |
| `requires_review`    | **soft**  | Auto-decision was inconclusive; waiting on a human reviewer.             |
| `approved`           | **yes**   | Identity verified; all checks passed (auto or after review).             |
| `rejected`           | **yes**   | Verification failed, or a reviewer rejected it.                          |
| `expired`            | **yes**   | The session's TTL elapsed before the user finished.                      |
| `cancelled`          | **yes**   | Cancelled via the API or the dashboard.                                  |

`requires_review` is a **soft-terminal** state: the session stops advancing on
its own, but a reviewer (or the [Dashboard API](/api/dashboard)) will move it to
`approved` or `rejected`. Treat it as "decision pending," not "done."

Match statuses with **exact, lowercase** string comparison; they are stable
identifiers, not display copy.

## Decisions

Two decision fields sit alongside the status:

- **`auto_decision`** is the decision engine's output: `approved`,
  `requires_review`, or `rejected` (or `null` before `processing`).
- **`final_decision`** is the decision of record. It equals `auto_decision`
  unless a human review overrode it, and is `null` while a session is still in
  `requires_review`.

Always key your business logic on **`final_decision`** (falling back to the
terminal `status`). `auto_decision` is informational, useful for analytics on
how often the engine defers to review.

## Decision reasons

`decision_reason` explains _why_ a session reached its decision. It's a stable
enum you can branch on (the message may change; the key won't).

| Group         | `decision_reason`                                                           |
| ------------- | --------------------------------------------------------------------------- |
| Approved      | `AUTO_APPROVED`, `MANUAL_APPROVAL`                                          |
| Document      | `LOW_DOCUMENT_QUALITY`, `OCR_LOW_CONFIDENCE`, `DOCUMENT_EXPIRED`            |
| Liveness      | `LIVENESS_FAILED`, `LIVENESS_LOW_CONFIDENCE`                                |
| Face match    | `FACE_MATCH_FAILED`, `FACE_MATCH_LOW_CONFIDENCE`, `MULTIPLE_FACES_DETECTED` |
| Address       | `ADDRESS_VERIFICATION_FAILED`, `ADDRESS_LOW_CONFIDENCE`                     |
| Manual / flow | `MANUAL_REJECTION`, `RETRY_REQUESTED`                                       |

The `*_LOW_CONFIDENCE` reasons route a session to `requires_review` rather than
an outright `rejected`; the signal was ambiguous, not failing. `RETRY_REQUESTED`
means a reviewer asked the user to redo a step.

## Reading a result

Retrieve a session any time with the SDK (or `GET /api/v1/sessions/{id}`):

```ts
const session = await arkyc.sessions.retrieve(sessionId)
// session.status, session.final_decision, session.decision_reason, session.risk_score, …
```

Fields most integrations use:

| Field             | Type                           | Notes                                                   |
| ----------------- | ------------------------------ | ------------------------------------------------------- |
| `status`          | `VerificationStatus`           | Lifecycle state (table above).                          |
| `auto_decision`   | `VerificationDecision \| null` | Decision engine output.                                 |
| `final_decision`  | `VerificationDecision \| null` | Decision of record; branch on this.                     |
| `decision_reason` | `DecisionReason \| null`       | Why (enum above).                                       |
| `risk_score`      | `number \| null`               | Aggregate risk in `[0, 1]`; higher is riskier.          |
| `name`            | `string \| null`               | Name extracted from the document (OCR), when available. |
| `user_reference`  | `string \| null`               | Your id for the user, echoed back for correlation.      |
| `completed_at`    | ISO datetime `\| null`         | When the session reached a terminal decision.           |
| `expires_at`      | ISO datetime                   | When an unfinished session expires.                     |

Per-check detail is delivered on the [webhook payload](/integrations/webhooks#payload)
under `checks`: document quality/OCR, liveness score, and face-match similarity.

## Handling each outcome

| Outcome                         | What to do                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `final_decision: approved`      | Grant access; persist the verification against your user.                                      |
| `final_decision: rejected`      | Deny; optionally offer a fresh session if the reason is correctable (e.g. `DOCUMENT_EXPIRED`). |
| `status: requires_review`       | Wait, and don't grant access. A reviewer settles it; you'll get a follow-up webhook.           |
| `status: expired` / `cancelled` | Nothing verified. Create a new session and re-prompt the user.                                 |

The widget's `onComplete` is a **UX signal only**; use it to advance your UI.
Treat the **webhook** (or a server-side `retrieve`) as your source of truth,
since the browser can close before the decision settles.

## Session expiry

A session is valid for **15 minutes** from creation, and its client token
expires with it. If the user doesn't finish in time, the session lazily
transitions to `expired` the next time it's touched (a widget call or a
`retrieve`), and any further submissions are rejected. The window is fixed; to
retry an expired or abandoned user, create a **new** session and hand the fresh
token to the widget.

## Idempotent creation

`sessions.create` is **not** idempotent: each call opens a new session with its
own token. To avoid stacking duplicate sessions for one user (a double form
submit, a retried request, a re-render), dedupe on your side. Store the returned
`session.id` keyed by your `user_reference`, and reuse a session that's still
`pending`/in progress instead of creating another; only start a fresh one once
the previous is terminal or expired.

## Capture-only

If your workflow runs with OCR/decisioning off (capture-only), a session still
moves through the capture statuses and completes, but the decision is left to
you: pull the captured document and selfie artifacts (signed URLs on the
session) and forward them to your own KYC provider. See the
[server SDK](/integrations/sdk).
