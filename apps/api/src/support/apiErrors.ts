import type { ApiErrorKey } from '@arkyc/types'
import { RequestException } from '@arkstack/common'

/**
 * The catalog of errors **we** deliberately return, each keyed by a stable,
 * machine-readable identifier (the `error` field) that never changes unless
 * it's a breaking change.
 *
 * The key set is the client-facing contract {@link ApiErrorKey} in
 * `@arkyc/types`; typing the catalog as `Record<ApiErrorKey, …>` keeps the
 * server and the typed clients in lockstep — a new contract key won't compile
 * until it has an entry here, and vice versa.
 */
export const API_ERRORS: Record<ApiErrorKey, { status: number; message: string }> = {
  // Client token (widget → Client API)
  missing_client_token: { status: 401, message: 'Missing client token' },
  invalid_client_token: { status: 401, message: 'Invalid client token' },
  session_expired: { status: 401, message: 'Session expired' },
  origin_not_allowed: { status: 403, message: 'Request origin is not allowed for this project' },

  // API key (integrator backend → Project API)
  missing_api_key: { status: 401, message: 'Missing API key' },
  invalid_api_key: { status: 401, message: 'Invalid or expired API key' },

  // Session creation inputs
  invalid_workflow: { status: 422, message: 'Unknown or invalid workflow' },
  invalid_webhook: {
    status: 422,
    message: 'Unknown or invalid webhook endpoint',
  },
}

export type { ApiErrorKey }

/**
 * An error we deliberately raise. Extends `RequestException`, so it throws
 * like any other framework error (from middleware, a controller, or
 * a service)
 * @example throw new ApiException('session_expired')
 */
export class ApiException extends RequestException {
  /**
   * Merged into the response payload by the framework's error renderer.
   */
  readonly body: { error: ApiErrorKey }

  constructor(key: ApiErrorKey, message?: string) {
    const entry = API_ERRORS[key]
    super(message ?? entry.message, entry.status)
    this.name = 'ApiException'
    this.body = { error: key }
  }
}
