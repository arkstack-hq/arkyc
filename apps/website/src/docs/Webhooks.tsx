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

      <h2>Verify the signature</h2>
      <p>
        Verify each delivery with the project’s signing secret before trusting it. Pass the <strong>raw</strong> request
        body — not the parsed JSON.
      </p>
      <CodeCard
        title="webhook-handler.ts"
        code={`import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({ secretKey })

app.post('/webhooks/arkyc', async (req, res) => {
  const signature = req.headers['arkyc-signature']

  let event
  try {
    event = arkyc.webhooks.verify(req.rawBody, signature, WEBHOOK_SECRET)
  } catch {
    return res.status(400).send('invalid signature')
  }

  if (event.type === 'verification.approved') {
    await activateUser(event.data.userReference)
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
