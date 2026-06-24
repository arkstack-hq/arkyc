import { CodeCard } from '@/components/CodeCard'
import { Prose } from '@/components/Prose'

export function Webhooks() {
  return (
    <Prose>
      <h1>Webhooks</h1>
      <p>
        Webhooks are your source of truth for the verification decision. Add an endpoint to your project in the
        dashboard, choose which events to receive, and Arkyc delivers each one, HMAC-SHA256 signed, with automatic
        retries and a deliveries log.
      </p>

      <h2>Events</h2>
      <ul>
        <li>
          <code>verification.started</code>, <code>verification.document_submitted</code>,{' '}
          <code>verification.processing</code>
        </li>
        <li>
          <code>verification.requires_review</code>, <code>verification.approved</code>,{' '}
          <code>verification.rejected</code>
        </li>
        <li>
          <code>verification.completed</code>, <code>verification.expired</code>, <code>verification.cancelled</code>
        </li>
      </ul>
      <p>
        A verification lands in <code>verification.requires_review</code> when a signal is borderline low document
        quality or OCR confidence, a liveness/face-match near the threshold, or, when AI document processing is enabled,
        a best-effort <strong>tamper or screen-replay</strong> flag on the document. These hold for a human decision
        rather than auto-rejecting, so always treat <code>requires_review</code> as non-final.
      </p>

      <h2>Payload</h2>
      <p>
        Every delivery is a JSON body in this shape (snake_case). <code>checks</code> carries the per-stage summaries
        and <code>assets</code> holds signed, time-limited image URLs when any were captured.
      </p>
      <CodeCard
        title="payload.json"
        lang="json"
        code={`{
  "event": "verification.approved",
  "session_id": "ses_123",
  "organization_id": "org_123",
  "project_id": "prj_123",
  "user_reference": "user_456",
  "status": "approved",
  "decision_reason": "AUTO_APPROVED",
  "checks": { "document": { }, "liveness": { }, "face_match": { } },
  "assets": { "document_front": "https://…", "selfie": "https://…" },
  "created_at": "2026-06-24T10:00:00.000Z"
}`}
      />

      <h2>Verify the signature</h2>
      <p>
        Verify each delivery before trusting it: <code>arkyc.webhooks.verify(...)</code> recomputes the HMAC over{' '}
        <code>{'`${timestamp}.${rawBody}`'}</code> and checks the timestamp is within tolerance (5&nbsp;min, so a
        captured body can’t be replayed). Pass the <strong>raw</strong> body string, not the parsed JSON, and the two
        signature headers.
      </p>
      <CodeCard
        title="webhook-handler.ts"
        code={`import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({ secretKey })

app.post('/webhooks/arkyc', async (req, res) => {
  const ok = arkyc.webhooks.verify({
    payload: req.rawBody, // the raw request body, as a string
    secret: WEBHOOK_SECRET, // the endpoint's signing secret
    signature: req.header('X-Arkyc-Signature'),
    timestamp: Number(req.header('X-Arkyc-Timestamp')),
  })

  if (!ok) return res.status(400).send('invalid signature')

  const event = JSON.parse(req.rawBody)
  if (event.event === 'verification.approved') {
    await activateUser(event.user_reference)
  }

  res.sendStatus(200)
})`}
      />

      <h2>Retries and deliveries</h2>
      <p>
        Non-2xx responses are retried with backoff. Every attempt is recorded in the project’s deliveries log in the
        dashboard, where you can inspect payloads and replay a delivery. Respond <code>2xx</code> quickly and process
        asynchronously.
      </p>
    </Prose>
  )
}
