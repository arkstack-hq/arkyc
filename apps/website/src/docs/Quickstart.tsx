import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'
import { links } from '@/lib/site'

export function Quickstart() {
  return (
    <Prose>
      <h1>Getting started</h1>
      <p>
        Arkyc verifies your users’ identities, document capture, liveness, face match and an automated decision behind
        one API and an embeddable widget. This guide integrates the <strong>hosted</strong> product in four steps.
        Prefer to run it yourself? See the{' '}
        <a href={links.ossDocs} target="_blank" rel="noreferrer">
          self-hosting docs
        </a>
        .
      </p>

      <h2>1. Create a project and get keys</h2>
      <p>
        <a href={links.signup} target="_blank" rel="noreferrer">
          Create an account
        </a>
        , add a project in the dashboard, and copy its <strong>secret key</strong> (server-side) and{' '}
        <strong>publishable key</strong>. Keep the secret key on your backend only.
      </p>

      <h2>2. Install the SDK</h2>
      <CodeCard code={`pnpm add @arkyc/sdk`} />

      <h2>3. Create a session (server)</h2>
      <p>
        On your backend, create a verification session and return its short-lived <code>clientToken</code> to your
        frontend.
      </p>
      <CodeCard
        title="server.ts"
        code={`import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({ secretKey: process.env.ARKYC_SECRET_KEY })

const session = await arkyc.sessions.create({
  projectId: 'prj_123',
  userReference: 'user_456', // your id for this user
})

return { clientToken: session.clientToken }`}
      />

      <h2>4. Embed the widget (client)</h2>
      <p>Open the widget with that token, your user completes capture and liveness.</p>
      <CodeCard
        title="client.ts"
        code={`import { ArkycWidget } from '@arkyc/sdk/browser'

ArkycWidget.open({
  token: clientToken,
  onComplete: (result) => console.log(result.status),
  onError: (err) => console.error(err),
})`}
      />

      <h2>Handle the result</h2>
      <p>
        Listen for the decision with a <Link to="/docs/webhooks">signed webhook</Link> (recommended for your source of
        truth), and optionally react in the browser via <code>onComplete</code>. Next: embed the{' '}
        <Link to="/docs/widget">widget</Link>, explore the <Link to="/docs/sdk">server SDK</Link>, or wire up{' '}
        <Link to="/docs/webhooks">webhooks</Link>.
      </p>
    </Prose>
  )
}
