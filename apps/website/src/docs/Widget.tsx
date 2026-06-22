import { Prose } from '@/components/Prose'
import { CodeCard } from '@/components/CodeCard'

export function Widget() {
  return (
    <Prose>
      <h1>Embed the widget</h1>
      <p>
        The widget runs the guided capture flow — document, selfie and liveness — and talks only to Arkyc with the
        short-lived client token from your server. It works in three modes: <strong>overlay</strong>,{' '}
        <strong>inline</strong>, and a <strong>hosted</strong> page.
      </p>

      <h2>Install</h2>
      <p>Use the SDK’s browser entry, or the standalone script for a no-bundler setup.</p>
      <CodeCard
        code={`// Bundler
import { ArkycWidget } from '@arkyc/sdk/browser'

// Or via script tag — exposes window.Arkyc
// <script src="https://cdn.arkyc.dev/widget.js"></script>`}
      />

      <h2>Open as an overlay</h2>
      <CodeCard
        title="overlay.ts"
        code={`ArkycWidget.open({
  token: clientToken,
  onComplete: (result) => {
    // result.status: 'approved' | 'requires_review' | 'rejected' | ...
  },
  onError: (err) => showError(err),
  onClose: () => {},
})`}
      />

      <h2>Mount inline</h2>
      <p>Render the flow inside an element on your page instead of an overlay.</p>
      <CodeCard code={`ArkycWidget.mount('#arkyc', { token: clientToken, onComplete })`} />

      <h2>Theming</h2>
      <p>
        The widget is themed from your project’s branding — primary color, logo and corner radius — configured in the
        dashboard, so it matches your product without extra code.
      </p>

      <h2>Callbacks</h2>
      <ul>
        <li>
          <code>onComplete(result)</code> — the flow finished; inspect <code>result.status</code>.
        </li>
        <li>
          <code>onError(error)</code> — the session errored or expired.
        </li>
        <li>
          <code>onClose()</code> — the user dismissed the widget.
        </li>
      </ul>
      <p>
        Treat <code>onComplete</code> as a UX signal — use <strong>webhooks</strong> as your source of truth for the
        final decision.
      </p>
    </Prose>
  )
}
