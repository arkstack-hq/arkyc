import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'

export function WidgetEmbed() {
  return (
    <Prose>
      <h1>
        Embed <code>@arkyc/widget</code>
      </h1>
      <p>
        Bundle the verification flow into <strong>your own frontend</strong> and drive it from your{' '}
        <strong>own backend</strong>. Two pieces: your backend mints a one-time session token with the{' '}
        <Link to="/docs/sdk">server SDK</Link>, and your frontend renders <code>@arkyc/widget</code>, which talks
        directly to the Arkyc Client API with that token. You get full control of layout overlay, inline, or fullscreen
        and you ship widget updates by upgrading the package.
      </p>
      <p>
        Don’t want to bundle anything? Use the <Link to="/docs/widget">hosted launcher</Link> (
        <code>@arkyc/sdk/browser</code>) instead, it loads the hosted widget in an iframe.
      </p>

      <h2>Install</h2>
      <CodeCard code={['// Bundler', "import { ArkycWidget } from '@arkyc/widget'"]} />
      <br />
      <CodeCard
        title="no-bundler.html"
        lang="xml"
        code={[
          '<!-- Standalone IIFE; exposes window.Arkyc -->',
          '<script src="https://cdn.jsdelivr.net/npm/@arkyc/widget/standalone"></script>',
          '<script>Arkyc.mount({ token, container: "#verify" })</script>',
        ]}
      />

      <h2>1 · Mint a session (your backend)</h2>
      <p>
        The widget never sees your secret key. On your server, create a session with the SDK and return only the{' '}
        <code>clientToken</code> to the browser.
      </p>
      <CodeCard
        title="server.ts"
        code={[
          "import { Arkyc } from '@arkyc/sdk'",
          '',
          'const arkyc = new Arkyc({ secretKey: process.env.ARKYC_SECRET_KEY! })',
          '',
          '// e.g. POST /verify/start on your backend',
          "app.post('/verify/start', async (req, res) => {",
          '  const { clientToken } = await arkyc.sessions.create({',
          '    userReference: req.user.id,        // your id for the user',
          "    workflowId: 'wf_...',              // optional: a custom workflow",
          '  })',
          '  res.json({ clientToken })            // hand this to the frontend',
          '})',
        ]}
      />

      <h2>2 · Point the widget at the API (optional)</h2>
      <p>
        <code>baseUrl</code> is <strong>optional</strong>; it defaults to the hosted Arkyc API, so the hosted product is
        zero-config (the browser calls it cross-origin with the token; the API allows it via CORS). You only set it to
        self-host or proxy. It’s a <strong>base</strong>: the widget appends a fixed path per call (
        <code>/session</code>, <code>/document/front</code>, …) and adds <strong>no</strong> version prefix.
      </p>
      <ul>
        <li>
          <strong>A relative path</strong> (e.g. <code>/api/v1/client</code>) → resolved against your page’s current
          origin. Same-origin, so no CORS; use this when your backend proxies the Client API under your own domain.
        </li>
        <li>
          <strong>An absolute URL</strong> (e.g. <code>https://api.example.com/api/v1/client</code>) → used as-is. The
          API must allow your origin via <strong>CORS</strong>.
        </li>
      </ul>
      <p>
        To route through your own backend, set <code>baseUrl</code> to a prefix you control and proxy each path to
        Arkyc’s <code>/api/v1/client/*</code> (see <a href="#endpoints">Endpoints</a>). Self-hosting the whole stack?
        You can instead bake your API as the widget’s default by building it with <code>ARKYC_API_URL</code>. Serve your
        page over <strong>HTTPS</strong>; browsers only grant camera (and geolocation, for the address step) on a secure
        origin.
      </p>

      <h2>3 · Render the widget (your frontend)</h2>

      <h3>Overlay: full-screen modal</h3>
      <p>
        <code>ArkycWidget.open(options)</code> mounts a dimmed overlay and returns a <code>WidgetHandle</code>. Pass{' '}
        <code>fullscreen: true</code> for edge-to-edge (no card max-size).
      </p>
      <CodeCard
        title="overlay.ts"
        code={[
          "import { ArkycWidget } from '@arkyc/widget'",
          '',
          "const { clientToken } = await fetch('/verify/start', { method: 'POST' }).then((r) => r.json())",
          '',
          'const handle = ArkycWidget.open({',
          '  token: clientToken,   // required; baseUrl defaults to the hosted API',
          '  fullscreen: true,     // optional: edge-to-edge',
          '  onComplete: (r) => done(r.status),',
          '  onError: (e) => showError(e),',
          '  onClose: () => {},',
          '})',
        ]}
      />

      <h3>Inline: mounted into a container</h3>
      <p>
        <code>ArkycWidget.mount(options)</code> renders into an element you provide, for a page-embedded flow instead of
        an overlay.
      </p>
      <CodeCard
        title="inline.ts"
        code={[
          'ArkycWidget.mount({',
          '  token: clientToken,',
          "  container: '#verify',   // string selector or an HTMLElement",
          '  onComplete: (r) => done(r.status),',
          '})',
        ]}
      />
      <p>
        The widget <strong>takes ownership of the container</strong>: it sizes the card to the host (not the viewport)
        and gives the element its own stacking context above sibling content, so it renders reliably even if the
        container is otherwise unstyled or shares the page with a full-screen app root. It only fills gaps (a container
        that sets its own <code>position</code> or <code>z-index</code> keeps them), so you stay in control of
        placement. Put the container where you want the flow to appear and size it as you like; the widget does the
        rest.
      </p>

      <h3>Hosted page: redirect &amp; cross-device</h3>
      <p>
        <code>ArkycWidget.hosted()</code> reads <code>?token=</code> (and an optional <code>?baseUrl=</code>) from the
        URL and runs the overlay flow, posting results to the opener. This is what a first-party <code>/verify</code>{' '}
        page (and the desktop→phone hand-off) uses.
      </p>
      <CodeCard
        title="verify-page.ts"
        code={['// On your https://app.example.com/verify page:', 'ArkycWidget.hosted()']}
      />

      <h2 id="endpoints">Endpoints to proxy</h2>
      <p>
        If you route the Client API through your own backend, set <code>baseUrl</code> to a prefix you control and
        forward each of these to Arkyc’s <code>/api/v1/client/*</code>, pass the <code>X-Client-Token</code> header and
        the request body through unchanged.
      </p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>
              <code>{'{baseUrl}'}</code> + …
            </th>
            <th>Proxy to (Arkyc)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['GET', '/session', '/api/v1/client/session'],
            ['POST', '/document/front', '/api/v1/client/document/front'],
            ['POST', '/document/back', '/api/v1/client/document/back'],
            ['POST', '/liveness', '/api/v1/client/liveness'],
            ['POST', '/address', '/api/v1/client/address'],
            ['POST', '/complete', '/api/v1/client/complete'],
            ['POST', '/realtime/auth', '/api/v1/client/realtime/auth'],
          ].map(([method, path, proxy]) => (
            <tr key={path}>
              <td>
                <code>{method}</code>
              </td>
              <td>
                <code>{path}</code>
              </td>
              <td>
                <code>{proxy}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <code>/realtime/auth</code> is only called when realtime runs over an authed transport (pusher/firebase).
        Against Arkyc directly (no proxy), just set <code>baseUrl</code> to <code>…/api/v1/client</code> and skip this.
      </p>

      <h2>Options</h2>
      <p>
        <code>open</code> and <code>mount</code> share <code>BaseWidgetOptions</code> (<code>mount</code> adds{' '}
        <code>container</code>):
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
              <strong>Required.</strong> The session’s one-time client token from <code>arkyc.sessions.create</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>baseUrl</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>
              <strong>Optional</strong>, defaults to the hosted Arkyc API. Client API base; the widget appends{' '}
              <code>/session</code>, … (no version prefix). Relative ⇒ current origin (no CORS); absolute ⇒ as-is (needs
              CORS).
            </td>
          </tr>
          <tr>
            <td>
              <code>container</code>
            </td>
            <td>
              <code>string | HTMLElement</code>
            </td>
            <td>
              <code>mount</code> only where to render inline.
            </td>
          </tr>
          <tr>
            <td>
              <code>fullscreen</code>
            </td>
            <td>
              <code>boolean</code>
            </td>
            <td>
              <code>open</code> only edge-to-edge, no card max-size or backdrop gap.
            </td>
          </tr>
          <tr>
            <td>
              <code>handoff</code>
            </td>
            <td>
              <code>boolean</code>
            </td>
            <td>
              Cross-device desktop→phone hand-off (QR), on by default. Uses a first-party hosted page; you host nothing.
              Set <code>false</code> to disable.
            </td>
          </tr>
          <tr>
            <td>
              <code>branding</code>
            </td>
            <td>
              <code>ProjectBranding | null</code>
            </td>
            <td>Colors, logo, radius, theme. Sourced from project config by default.</td>
          </tr>
          <tr>
            <td>
              <code>onComplete</code> / <code>onError</code> / <code>onClose</code>
            </td>
            <td>
              <code>(…) =&gt; void</code>
            </td>
            <td>Terminal result, session error/expiry, and overlay teardown.</td>
          </tr>
          <tr>
            <td>
              <code>onEvent</code>
            </td>
            <td>
              <code>(event: WidgetEvent) =&gt; void</code>
            </td>
            <td>
              Live firehose of <code>session.transition</code> + lifecycle events.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The handle</h2>
      <p>
        <code>open</code> and <code>mount</code> return a <code>WidgetHandle</code>: <code>close()</code> to tear it
        down, and <code>on(name, listener)</code> to subscribe to a single event (returns an unsubscribe function).{' '}
        <code>name</code> is a known event name (<code>session.transition</code> · <code>complete</code> ·{' '}
        <code>error</code> · <code>close</code>) and the <code>listener</code>&rsquo;s <code>data</code> is typed from
        it.
      </p>
      <CodeCard
        title="handle.ts"
        code={[
          'const handle = ArkycWidget.open({ token: clientToken })',
          '',
          "const off = handle.on('session.transition', (data) => updateProgress(data))",
          '// later…',
          'off()',
          'handle.close()',
        ]}
      />

      <h2>Result &amp; events</h2>
      <p>
        <code>onComplete</code> receives a <code>WidgetResult</code> whose <code>status</code> is <code>approved</code>{' '}
        · <code>requires_review</code> · <code>rejected</code> (or <code>processing</code> / <code>expired</code> /{' '}
        <code>cancelled</code>). Treat it as a UX signal; use <Link to="/docs/webhooks">webhooks</Link> as your source
        of truth.
      </p>
      <p>
        <code>onError</code> receives a <code>WidgetApiError</code> with the HTTP <code>status</code> and a stable{' '}
        <code>error</code> key; branch on it, e.g. mint a fresh token when <code>err.error === 'session_expired'</code>.
        It fires <strong>the moment the flow fails</strong> (including an expired session or token), so you can react
        without waiting for the user to dismiss the screen. See <Link to="/docs/errors">Error codes</Link>.
      </p>

      <h2>Theming</h2>
      <p>
        The widget themes itself from your project branding (primary color, logo, corner radius) configured in the
        dashboard, or pass <code>branding</code> explicitly. No CSS required.
      </p>

      <h2>Capture-only</h2>
      <p>
        Run a workflow with OCR/decisioning off to use Arkyc purely for high-quality document + selfie capture, then
        forward the artifacts (signed URLs on the session) to your own KYC provider, see the{' '}
        <Link to="/docs/sdk">server SDK</Link>.
      </p>
    </Prose>
  )
}
