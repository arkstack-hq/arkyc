import { CodeCard } from '@/components/CodeCard'
import { Link } from 'react-router-dom'
import { Prose } from '@/components/Prose'

const ERRORS = [
  ['missing_client_token', '401', 'No client token on a Client/Widget API request.'],
  ['invalid_client_token', '401', "The client token doesn't resolve to a session."],
  ['session_expired', '401', 'The session (and its client token) has expired.'],
  ['missing_api_key', '401', 'No secret key on a Public Project API request.'],
  ['invalid_api_key', '401', 'The secret key is unknown, revoked, or expired.'],
  ['invalid_workflow', '422', 'workflow_id is unknown for this organization.'],
  ['invalid_webhook', '422', 'The referenced webhook endpoint is unknown or invalid.'],
]

export function ErrorCodes() {
  return (
    <Prose>
      <h1>Error codes</h1>
      <p>
        Errors <strong>Arkyc deliberately raises</strong> carry a stable, machine-readable <code>error</code> key
        alongside the HTTP <code>status</code>.
      </p>
      <CodeCard
        title="error envelope"
        lang="json"
        code={[
          '{',
          '  "status": "error",',
          '  "code": 401,',
          '  "error": "session_expired",',
          '  "message": "Session expired"',
          '}',
        ]}
      />
      <p>
        This disambiguates cases that share an HTTP status — a <code>401</code> could be an expired session, a bad
        client token, or an invalid API key.
      </p>

      <h2 id="catalog">Catalog</h2>
      <table>
        <thead>
          <tr>
            <th>
              <code>error</code>
            </th>
            <th>HTTP</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {ERRORS.map(([error, status, meaning]) => (
            <tr key={error}>
              <td>
                <code>{error}</code>
              </td>
              <td>
                <code>{status}</code>
              </td>
              <td>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Responses <strong>without</strong> an <code>error</code> key are unexpected/unhandled — treat them generically
        by <code>status</code>. Only the keys above are part of this contract.
      </p>

      <h2>Reading the key from a client</h2>
      <p>
        Both typed clients surface the key, typed as the <code>ApiErrorKey</code> union so your editor autocompletes
        every case and flags a typo. The <Link to="/docs/sdk">server SDK</Link> throws an <code>ArkycApiError</code>{' '}
        with <code>err.error</code>; the <Link to="/docs/widget-embed">widget</Link> passes a{' '}
        <code>WidgetApiError</code> with <code>err.error</code> to <code>onError</code>. Both re-export the{' '}
        <code>ApiErrorKey</code> type.
      </p>
      <CodeCard
        title="branch on the key"
        code={[
          "import { ArkycApiError } from '@arkyc/sdk'",
          '',
          'try {',
          '  await arkyc.sessions.create({ userReference, workflowId })',
          '} catch (err) {',
          '  if (err instanceof ArkycApiError) {',
          "    if (err.error === 'invalid_api_key') return rotateKey()",
          "    if (err.error === 'invalid_workflow') return useDefaultWorkflow()",
          '    // no `error` key → unexpected; handle by err.status',
          '  }',
          '}',
        ]}
      />
    </Prose>
  )
}
