/**
 * Error thrown when the Arkyc API returns a non-2xx response.
 */
export class ArkycApiError extends Error {
  /** HTTP status code. */
  readonly status: number
  /**
   * Stable error key (e.g. `invalid_api_key`, `invalid_workflow`)
   * for errors Arkyc deliberately raises. Undefined for unexpected errors.
   */
  readonly error?: string
  /**
   * Field-level validation errors, when present (422).
   */
  readonly errors?: Record<string, string[] | string>

  constructor(message: string, status: number, errors?: Record<string, string[] | string>, error?: string) {
    super(message)
    this.name = 'ArkycApiError'
    this.status = status
    this.errors = errors
    this.error = error
  }
}
