import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'

const STATUSES: [string, string, string][] = [
  ['pending', 'no', 'Session created; the client token is minted but the user hasn’t started.'],
  ['started', 'no', 'The user opened the widget and began the flow.'],
  ['document_submitted', 'no', 'Document image(s) uploaded.'],
  ['address_submitted', 'no', 'Address step completed (only if the workflow includes it).'],
  ['liveness_submitted', 'no', 'Selfie / liveness captured.'],
  ['processing', 'no', 'Running OCR, liveness, face match, and the decision engine.'],
  ['requires_review', 'soft', 'Auto-decision was inconclusive; waiting on a human reviewer.'],
  ['approved', 'yes', 'Identity verified; all checks passed (auto or after review).'],
  ['rejected', 'yes', 'Verification failed, or a reviewer rejected it.'],
  ['expired', 'yes', 'The session’s TTL elapsed before the user finished.'],
  ['cancelled', 'yes', 'Cancelled via the API or the dashboard.'],
]

const REASONS: [string, string][] = [
  ['Approved', 'AUTO_APPROVED, MANUAL_APPROVAL'],
  ['Document', 'LOW_DOCUMENT_QUALITY, OCR_LOW_CONFIDENCE, DOCUMENT_EXPIRED'],
  ['Liveness', 'LIVENESS_FAILED, LIVENESS_LOW_CONFIDENCE'],
  ['Face match', 'FACE_MATCH_FAILED, FACE_MATCH_LOW_CONFIDENCE, MULTIPLE_FACES_DETECTED'],
  ['Address', 'ADDRESS_VERIFICATION_FAILED, ADDRESS_LOW_CONFIDENCE'],
  ['Manual / flow', 'MANUAL_REJECTION, RETRY_REQUESTED'],
]

export function VerificationLifecycle() {
  return (
    <Prose>
      <h1>Verification lifecycle &amp; results</h1>
      <p>
        Every verification is one <strong>session</strong> that moves through a lifecycle and ends on a{' '}
        <strong>decision</strong>. This is the reference for the statuses a session can hold, how they map to a
        decision, and the result you read back, from the <Link to="/docs/sdk">server SDK</Link> or a{' '}
        <Link to="/docs/webhooks">webhook</Link>.
      </p>

      <h2>Session statuses</h2>
      <p>
        A session’s <code>status</code> is its lifecycle state. Progress statuses advance as the user completes each
        step; the flow then settles on a terminal status (or waits in <code>requires_review</code> for a human). Compare
        with exact, lowercase strings; these are stable identifiers, not display copy.
      </p>
      <table>
        <thead>
          <tr>
            <th>
              <code>status</code>
            </th>
            <th>Terminal?</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {STATUSES.map(([status, terminal, meaning]) => (
            <tr key={status}>
              <td>
                <code>{status}</code>
              </td>
              <td>{terminal}</td>
              <td>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <code>requires_review</code> is <strong>soft-terminal</strong>: the session stops advancing on its own, but a
        reviewer moves it to <code>approved</code> or <code>rejected</code>. Treat it as “decision pending,” not “done.”
      </p>

      <h2>Decisions</h2>
      <p>
        Two decision fields sit alongside the status. <code>auto_decision</code> is the engine’s output (
        <code>approved</code> · <code>requires_review</code> · <code>rejected</code>); <code>final_decision</code> is
        the decision of record, equal to <code>auto_decision</code> unless a human review overrode it, and{' '}
        <code>null</code> while a session is still in review. <strong>Branch on `final_decision`</strong> (falling back
        to the terminal status); <code>auto_decision</code> is informational.
      </p>

      <h2>Decision reasons</h2>
      <p>
        <code>decision_reason</code> explains <em>why</em> a session reached its decision; it’s a stable enum you can
        branch on. The <code>*_LOW_CONFIDENCE</code> reasons route to <code>requires_review</code> (ambiguous signal)
        rather than an outright <code>rejected</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>
              <code>decision_reason</code>
            </th>
          </tr>
        </thead>
        <tbody>
          {REASONS.map(([group, reasons]) => (
            <tr key={group}>
              <td>{group}</td>
              <td>
                <code>{reasons}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Reading a result</h2>
      <p>Retrieve a session at any time from your backend:</p>
      <CodeCard
        title="result.ts"
        code={[
          'const session = await arkyc.sessions.retrieve(sessionId)',
          '',
          'if (session.final_decision === "approved") grantAccess()',
          'else if (session.status === "requires_review") waitForReview()',
          'else denyOrRetry(session.decision_reason)   // e.g. DOCUMENT_EXPIRED → offer a fresh session',
        ]}
      />
      <p>
        Key fields: <code>status</code>, <code>auto_decision</code>, <code>final_decision</code>,{' '}
        <code>decision_reason</code>, <code>risk_score</code> (aggregate risk in <code>[0, 1]</code>, higher is
        riskier), <code>name</code> (OCR-extracted, when available), <code>user_reference</code>, and{' '}
        <code>completed_at</code>. Per-check detail (document quality/OCR, liveness score, face-match similarity) rides
        on the <Link to="/docs/webhooks">webhook</Link> under <code>checks</code>.
      </p>

      <h2>Handling each outcome</h2>
      <table>
        <thead>
          <tr>
            <th>Outcome</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>final_decision: approved</code>
            </td>
            <td>Grant access; persist the verification against your user.</td>
          </tr>
          <tr>
            <td>
              <code>final_decision: rejected</code>
            </td>
            <td>Deny; optionally offer a fresh session if the reason is correctable.</td>
          </tr>
          <tr>
            <td>
              <code>status: requires_review</code>
            </td>
            <td>Wait, and don’t grant access. A reviewer settles it; you’ll get a follow-up webhook.</td>
          </tr>
          <tr>
            <td>
              <code>status: expired / cancelled</code>
            </td>
            <td>Nothing verified. Create a new session and re-prompt.</td>
          </tr>
        </tbody>
      </table>
      <p>
        The widget’s <code>onComplete</code> is a <strong>UX signal only</strong>. Treat the webhook (or a server-side{' '}
        <code>retrieve</code>) as your source of truth; the browser can close before the decision settles.
      </p>
    </Prose>
  )
}
