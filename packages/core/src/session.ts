import type { IsoDate, IsoDateTime, VerificationStatus } from '@arkyc/types'

import { StatusMachine } from './status'

/** Coerce an ISO string or Date into epoch milliseconds. */
function toMillis(value: IsoDateTime | IsoDate | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/** Pure session/document expiry rules. */
export class SessionRules {
  /**
   * Whether a session has passed its `expires_at` instant.
   *
   * `now` is injected (not read from the clock) so this stays pure and testable.
   *
   * @param expiresAt
   * @param now
   * @returns
   */
  static isSessionExpired(expiresAt: IsoDateTime | Date, now: IsoDateTime | Date): boolean {
    return toMillis(now) >= toMillis(expiresAt)
  }

  /**
   * Whether a document is expired relative to `now`.
   *
   * Expiry is treated as end-of-day: a document expiring on `now`'s date is still
   * valid that day. Returns `false` when no expiry date is known.
   *
   * @param expiryDate
   * @param now
   * @returns
   */
  static isDocumentExpired(expiryDate: IsoDate | null | undefined, now: IsoDateTime | Date): boolean {
    if (!expiryDate) return false
    const expiryEndOfDay = new Date(`${expiryDate}T23:59:59.999Z`).getTime()
    if (Number.isNaN(expiryEndOfDay)) return false
    return toMillis(now) > expiryEndOfDay
  }

  /**
   * Whether a session in `status` should be auto-expired given its `expires_at`.
   * Terminal sessions are never re-expired.
   *
   * @param status
   * @param expiresAt
   * @param now
   * @returns
   */
  static shouldExpire(status: VerificationStatus, expiresAt: IsoDateTime | Date, now: IsoDateTime | Date): boolean {
    if (StatusMachine.isTerminal(status)) return false
    return SessionRules.isSessionExpired(expiresAt, now)
  }
}
