import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'

export function Widget() {
  return (
    <Prose>
      <h1>Hosted launcher</h1>
      <p>
        <code>@arkyc/sdk/browser</code> opens the <strong>hosted</strong> widget in an overlay iframe, your frontend
        bundles almost nothing, and the only thing the browser needs is the one-time client token from your server. The
        widget runs the guided capture flow (document, selfie, liveness, plus an optional address step on custom
        workflows).
      </p>
      <p>
        Want to bundle the flow into your own frontend and point it at your API for full control of layout? Use{' '}
        <Link to="/docs/widget-embed">
          <code>@arkyc/widget</code>
        </Link>{' '}
        instead.
      </p>

      <h2>Install</h2>
      <p>Use the SDK’s browser entry with a bundler, or the standalone global script for a no-bundler setup.</p>
      <CodeCard code={['// Bundler', "import { ArkycWidget } from '@arkyc/sdk/browser'"]} />
      <br />
      <CodeCard
        title="no-bundler.html"
        lang="xml"
        code={[
          '<!-- Served from jsDelivr; exposes window.ArkycWidget -->',
          '<script src="https://cdn.jsdelivr.net/npm/@arkyc/widget/dist/arkyc-widget.iife.global.js"></script>',
          '<script>',
          '  ArkycWidget.open({ token: clientToken })',
          '</script>',
        ]}
      />

      <h2>Open as an overlay</h2>
      <p>
        <code>ArkycWidget.open(options)</code> mounts the hosted widget in a fullscreen overlay and returns a{' '}
        <strong>handle</strong>. <code>token</code> is the only required option; everything else is optional.
      </p>
      <CodeCard
        title="overlay.ts"
        code={[
          "import { ArkycWidget } from '@arkyc/sdk/browser'",
          '',
          'const handle = ArkycWidget.open({',
          '  token: clientToken,                 // required; from arkyc.sessions.create()',
          "  widgetUrl: 'https://arkyc.toneflix.net/verify', // optional: override the hosted origin",
          '',
          '  onComplete: (result) => {           // flow reached a terminal state',
          "    console.log(result.status)        // 'approved' | 'requires_review' | 'rejected' | …",
          '  },',
          '  onError: (error) => showError(error), // session errored or expired',
          '  onClose: () => {},                  // overlay torn down (also after complete/error)',
          '  onEvent: (event) => {               // live firehose of named events',
          '    console.log(event.name, event.data)',
          '  },',
          '})',
        ]}
      />

      <h3>Options</h3>
      <p>
        The full <code>OpenWidgetOptions</code> shape:
      </p>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>token</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>
              <strong>Required.</strong> The session’s one-time client token. <code>open()</code> throws if it’s
              missing.
            </td>
          </tr>
          <tr>
            <td>
              <code>widgetUrl</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>
              Hosted widget origin. Defaults to <code>https://arkyc.toneflix.net/verify</code>. Set this when
              self-hosting the widget.
            </td>
          </tr>
          <tr>
            <td>
              <code>onComplete</code>
            </td>
            <td>
              <code>(result: WidgetResult) =&gt; void</code>
            </td>
            <td>The flow reached a terminal state. The overlay then closes automatically.</td>
          </tr>
          <tr>
            <td>
              <code>onError</code>
            </td>
            <td>
              <code>(error: unknown) =&gt; void</code>
            </td>
            <td>The session errored or expired. The overlay then closes automatically.</td>
          </tr>
          <tr>
            <td>
              <code>onClose</code>
            </td>
            <td>
              <code>() =&gt; void</code>
            </td>
            <td>
              The overlay was torn down by the user dismissing it, by <code>handle.close()</code>, or after a
              complete/error.
            </td>
          </tr>
          <tr>
            <td>
              <code>onEvent</code>
            </td>
            <td>
              <code>(event: WidgetEvent) =&gt; void</code>
            </td>
            <td>
              Firehose of every named event (see <a href="#events">Events</a>).
            </td>
          </tr>
          <tr>
            <td>
              <code>doc</code> / <code>win</code>
            </td>
            <td>
              <code>Document</code> / <code>Window</code>
            </td>
            <td>
              Test injectables; default to the global <code>document</code> / <code>window</code>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The widget handle</h2>
      <p>
        <code>open()</code> returns a <code>WidgetHandle</code> so you can dismiss the widget or subscribe to a single
        event.
      </p>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Signature</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>close</code>
            </td>
            <td>
              <code>() =&gt; void</code>
            </td>
            <td>
              Remove the overlay and detach listeners. Triggers <code>onClose</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>on</code>
            </td>
            <td>
              <code>&lt;K extends WidgetEventName&gt;(event: K, listener: (data: WidgetEventMap[K]) =&gt; void) =&gt; () =&gt; void</code>
            </td>
            <td>
              Subscribe to one named event. <code>event</code> is a known event name and <code>data</code> is typed from it.
              Returns an unsubscribe function.
            </td>
          </tr>
        </tbody>
      </table>
      <CodeCard
        title="handle.ts"
        code={[
          'const handle = ArkycWidget.open({ token: clientToken })',
          '',
          '// Subscribe to one event; the call returns an unsubscribe fn.',
          "const off = handle.on('session.transition', (data) => {",
          '  updateProgress(data)',
          '})',
          '',
          '// Later, stop listening, or close the widget yourself.',
          'off()',
          'handle.close()',
        ]}
      />

      <h2 id="events">Events</h2>
      <p>
        <code>onEvent</code> receives a <code>WidgetEvent</code>, a discriminated union{' '}
        <code>{'{ name; data }'}</code> — <code>switch (event.name)</code> narrows <code>event.data</code> to the payload
        below. <code>handle.on(name, cb)</code> subscribes to one event and hands its <code>cb</code> just that event&rsquo;s{' '}
        <code>data</code>. Both are relayed from the hosted widget over <code>postMessage</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Fires when</th>
            <th>
              <code>data</code> payload
            </th>
            <th>Also surfaced as</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>session.transition</code>
            </td>
            <td>
              The session advances a stage (e.g. <code>document_submitted</code> → <code>processing</code>).
            </td>
            <td>
              <code>{'{ session_id, status, previous_status }'}</code>
            </td>
            <td>None</td>
          </tr>
          <tr>
            <td>
              <code>complete</code>
            </td>
            <td>The flow reached a terminal state.</td>
            <td>
              <code>WidgetResult</code>
            </td>
            <td>
              <code>onComplete(result)</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>error</code>
            </td>
            <td>The session errored or expired.</td>
            <td>
              <code>{'{ message, status?, error? }'}</code>
            </td>
            <td>
              <code>onError(error)</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>close</code>
            </td>
            <td>The overlay was dismissed.</td>
            <td>
              <code>undefined</code>
            </td>
            <td>
              <code>onClose()</code>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Result</h2>
      <p>
        <code>onComplete</code> receives a <code>WidgetResult</code>, <code>{'{ status, …extra }'}</code>, where{' '}
        <code>status</code> mirrors the verification status. Treat it as a UX signal; use{' '}
        <Link to="/docs/webhooks">webhooks</Link> as your source of truth.
      </p>
      <CodeCard
        title="result.ts"
        code={[
          'onComplete: (result) => {',
          '  // result.status:',
          "  //   'approved' | 'requires_review' | 'rejected'",
          "  //   | 'processing' | 'expired' | 'cancelled'",
          '  switch (result.status) {',
          "    case 'approved':        return onApproved()",
          "    case 'requires_review': return onPending()   // a human will decide",
          '    default:                return onRejected()',
          '  }',
          '}',
        ]}
      />

      <h2>Hosted page</h2>
      <p>
        Prefer a redirect (or a cross-device hand-off)? Send the user to the hosted widget URL with the token as a query
        param, the same page the overlay loads in its iframe.
      </p>
      <CodeCard title="redirect" lang="bash" code={['https://arkyc.toneflix.net/verify?token=<clientToken>']} />

      <h2>Rendering &amp; permissions</h2>
      <p>
        <code>open()</code> appends a fixed, fullscreen dimmed backdrop (at the maximum z-index) with a centered card up
        to <code>480×720&nbsp;px</code>, and an iframe that requests <code>camera</code> and <code>microphone</code>.
        Notes:
      </p>
      <ul>
        <li>
          Serve your page over <strong>HTTPS</strong>, browsers only grant camera access on a secure origin.
        </li>
        <li>
          Each <code>open()</code> mounts its own overlay; keep one open at a time (call <code>handle.close()</code>{' '}
          before re-opening).
        </li>
        <li>
          The overlay auto-closes on <code>complete</code> and <code>error</code>; you don’t need to call{' '}
          <code>close()</code> in those callbacks.
        </li>
      </ul>

      <h2>Theming</h2>
      <p>
        The widget is themed from your project’s branding, primary color, logo and corner radius configured in the
        dashboard so it matches your product without extra code.
      </p>

      <h2>Capture-only mode</h2>
      <p>
        Don’t need Arkyc’s decisioning? Run the widget purely to capture a high-quality document and selfie, then
        forward the artifacts to your own KYC provider. Your users get a flow they’ll finish; you keep your existing
        verification. The captured images are exposed as signed, time-limited URLs on the session’s <code>assets</code>{' '}
        see the <Link to="/docs/sdk">server SDK</Link> and <Link to="/docs/webhooks">webhooks</Link>.
      </p>
    </Prose>
  )
}
