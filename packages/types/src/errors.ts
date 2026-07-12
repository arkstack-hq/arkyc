/**
 * Stable, machine-readable error keys that Arkyc **deliberately raises**.
 *
 * These form a client-facing contract: the human-readable `message` may change,
 * but the `error` key on a response envelope will not. Branch on the key, not
 * the message. Responses without an `error` key are unexpected/unhandled and
 * should be treated generically by HTTP status.
 *
 * The typed clients surface this as `ArkycApiError.error` (`@arkyc/sdk`) and
 * `WidgetApiError.error` (`@arkyc/widget`).
 */
export type ApiErrorKey =
  | 'missing_client_token'
  | 'invalid_client_token'
  | 'session_expired'
  | 'origin_not_allowed'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'invalid_workflow'
  | 'invalid_webhook'
