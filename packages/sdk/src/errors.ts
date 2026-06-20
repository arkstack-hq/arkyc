/** Error thrown when the Arkyc API returns a non-2xx response. */
export class ArkycApiError extends Error {
  /** HTTP status code. */
  readonly status: number
  /** Field-level validation errors, when present (422). */
  readonly errors?: Record<string, string[] | string>

  constructor (message: string, status: number, errors?: Record<string, string[] | string>) {
    super(message)
    this.name = 'ArkycApiError'
    this.status = status
    this.errors = errors
  }
}
