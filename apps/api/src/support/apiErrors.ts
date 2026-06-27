import { RequestException } from '@arkstack/common'

/**
 * The catalog of errors **we** deliberately return.
 * each keyed by a stable, machine-readable identifier (the `error` field)
 * unless it's a breaking change.
 */
export const API_ERRORS = {
  // Client token (widget → Client API)
  missing_client_token: { status: 401, message: 'Missing client token' },
  invalid_client_token: { status: 401, message: 'Invalid client token' },
  session_expired: { status: 401, message: 'Session expired' },

  // API key (integrator backend → Project API)
  missing_api_key: { status: 401, message: 'Missing API key' },
  invalid_api_key: { status: 401, message: 'Invalid or expired API key' },

  // Session creation inputs
  invalid_workflow: { status: 422, message: 'Unknown or invalid workflow' },
  invalid_webhook: {
    status: 422,
    message: 'Unknown or invalid webhook endpoint',
  },
} as const

/**
 * A stable error identifier from {@link API_ERRORS} */
export type ApiErrorKey = keyof typeof API_ERRORS

/**
 * An error we deliberately raise. Extends `RequestException`, so it throws like
 * any other framework error (from middleware, a controller, or a service) — but
 * carries a `body`, which the framework's error renderer merges into the
 * response envelope.
 *
 * The client therefore receives `{ status: 'error', code, message, error }` where
 * `error` is the stable, machine-readable key. Override `message` freely; the key
 * is the contract.
 *
 * @example throw new ApiException('session_expired')
 */
export class ApiException extends RequestException {
  /** Merged into the response payload by the framework's error renderer. */
  readonly body: { error: ApiErrorKey }

  constructor(key: ApiErrorKey, message?: string) {
    const entry = API_ERRORS[key]
    super(message ?? entry.message, entry.status)
    this.name = 'ApiException'
    this.body = { error: key }
  }
}
