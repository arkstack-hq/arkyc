import EmptyResource from '@app/http/resources/EmptyResource'
import type { Response } from 'express'

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
 * A stable error identifier from {@link API_ERRORS} — the `error` field clients match on. */
export type ApiErrorKey = keyof typeof API_ERRORS

/**
 * The error envelope: the standard `{ status, code, message }` plus the stable
 * `error` key. `code` stays the HTTP status (matching success responses); `error`
 * is the machine-readable identifier.
 *
 * @param key
 * @param message  Override the catalog's default human message.
 * @returns
 */
export function apiErrorBody(key: ApiErrorKey, message?: string) {
  const entry = API_ERRORS[key]

  return { status: 'error' as const, error: key, code: entry.status, message: message ?? entry.message }
}

/**
 * Send one of our errors directly (for middleware, which holds `res` rather than
 * returning a resource).
 *
 * @param res
 * @param key
 * @param message
 */
export function sendApiError(res: Response, key: ApiErrorKey, message?: string): void {
  res.status(API_ERRORS[key].status).json(apiErrorBody(key, message))
}

/**
 * Return one of our errors from a controller, via the resource response's
 * `additional()` so it rides the same envelope as success responses.
 *
 * @param key
 * @param message
 * @returns
 */
export function apiError(key: ApiErrorKey, message?: string) {
  return new EmptyResource({}).additional(apiErrorBody(key, message)).response().setStatusCode(API_ERRORS[key].status)
}
