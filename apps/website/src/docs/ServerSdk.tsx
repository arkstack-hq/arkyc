import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'

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
        code={[
          "import { Arkyc } from '@arkyc/sdk'",
          '',
          'export const arkyc = new Arkyc({',
          '  secretKey: process.env.ARKYC_SECRET_KEY!,',
          '  // baseUrl defaults to the hosted API; override for self-hosted.',
          "  // workflowId: 'wf_…', // optional default workflow for every session",
          '})',
        ]}
      />

      <h2>Create a session</h2>
      <p>
        The project is determined by the secret key. <code>create</code> returns the session plus a one-time{' '}
        <code>clientToken</code> for the widget.
      </p>
      <CodeCard
        code={[
          'const { session, clientToken } = await arkyc.sessions.create({',
          "  userReference: 'user_456',     // optional: your id for the user",
          "  metadata: { plan: 'pro' },     // optional: stored with the session",
          "  // workflowId: 'wf_…',         // optional: overrides the client default",
          '})',
          '',
          '// clientToken -> hand to the widget',
          '// session.id  -> store to reconcile webhooks',
        ]}
      />

      <h2>Retrieve and cancel</h2>
      <CodeCard
        code={['const current = await arkyc.sessions.retrieve(session.id)', 'await arkyc.sessions.cancel(session.id)']}
      />

      <h2>Extracted PII</h2>
      <p>
        The verified identity and address data a session extracts (name, date of birth, document number, address) is
        available <strong>only through this server SDK</strong>, on <code>sessions.retrieve()</code>, authenticated with
        your secret key. It is <strong>never</strong> sent to the browser widget or included in webhooks. It appears on{' '}
        <code>session.extracted</code> only when your project holds a granted <strong>PII entitlement</strong> (request
        it under a project’s <strong>Extended access</strong> in the dashboard: choose the data categories, the timing,
        and a justification; a platform admin approves it).
      </p>
      <CodeCard
        code={[
          'const session = await arkyc.sessions.retrieve(sessionId)',
          '',
          '// Present only with a granted PII entitlement; null otherwise.',
          'if (session.extracted?.identity) {',
          '  const { full_name, date_of_birth, document_number } = session.extracted.identity',
          '}',
          'if (session.extracted?.address) {',
          '  const { line1, city, postal_code, country } = session.extracted.address',
          '}',
        ]}
      />
      <p>
        Only the <strong>granted categories</strong> appear (<code>identity</code> and/or <code>address</code>), and
        with <strong>after</strong> timing the data is withheld until the session is decided. Treat it as sensitive:
        request the minimum you need and store it per your own data policy.
      </p>

      <h2>Error handling</h2>
      <p>
        Failed requests throw a typed <code>ArkycApiError</code> carrying the HTTP <code>status</code>, a stable{' '}
        <code>error</code> key, and (on a 422) field-level <code>errors</code>.
      </p>
      <CodeCard
        code={[
          "import { ArkycApiError } from '@arkyc/sdk'",
          '',
          'try {',
          '  await arkyc.sessions.create({ userReference, workflowId })',
          '} catch (err) {',
          '  if (err instanceof ArkycApiError) {',
          "    if (err.error === 'invalid_api_key') return rotateKey()",
          "    if (err.error === 'invalid_workflow') return useDefaultWorkflow()",
          '    console.error(err.status, err.error, err.message)',
          '    if (err.errors) console.error(err.errors) // { field: [messages] } on 422',
          '  }',
          '}',
        ]}
      />
      <p>
        Errors with no <code>error</code> key are unexpected/unhandled; treat them generically by <code>status</code>.
        The full list is in <Link to="/docs/errors">Error codes</Link>.
      </p>

      <h2>Webhook verification</h2>
      <p>
        The SDK also verifies signed webhook deliveries, see <Link to="/docs/webhooks">Webhooks</Link>.
      </p>
    </Prose>
  )
}
