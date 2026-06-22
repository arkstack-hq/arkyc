import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'
import { CodeCard } from '@/components/CodeCard'

export function ServerSdk() {
  return (
    <Prose>
      <h1>Server SDK</h1>
      <p>
        <code>@arkyc/sdk</code> is a typed client for the hosted API. Use your project’s secret key on the server to
        create and manage verification sessions.
      </p>

      <h2>Install and initialize</h2>
      <CodeCard
        title="arkyc.ts"
        code={`import { Arkyc } from '@arkyc/sdk'

export const arkyc = new Arkyc({
  secretKey: process.env.ARKYC_SECRET_KEY!,
  // baseUrl defaults to the hosted API; override for self-hosted.
})`}
      />

      <h2>Create a session</h2>
      <CodeCard
        code={`const session = await arkyc.sessions.create({
  projectId: 'prj_123',
  userReference: 'user_456',
})

// session.clientToken -> hand to the widget
// session.id          -> store to reconcile webhooks`}
      />

      <h2>Retrieve and cancel</h2>
      <CodeCard
        code={`const current = await arkyc.sessions.retrieve(session.id)
await arkyc.sessions.cancel(session.id)`}
      />

      <h2>Error handling</h2>
      <p>
        Failed requests throw a typed <code>ArkycApiError</code> with the HTTP status and a machine-readable code.
      </p>
      <CodeCard
        code={`import { ArkycApiError } from '@arkyc/sdk'

try {
  await arkyc.sessions.create({ projectId, userReference })
} catch (err) {
  if (err instanceof ArkycApiError) {
    console.error(err.status, err.code, err.message)
  }
}`}
      />

      <h2>Webhook verification</h2>
      <p>
        The SDK also verifies signed webhook deliveries — see <Link to="/docs/webhooks">Webhooks</Link>.
      </p>
    </Prose>
  )
}
