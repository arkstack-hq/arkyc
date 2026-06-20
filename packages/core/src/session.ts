import type { IsoDate, IsoDateTime, VerificationStatus } from '@arkyc/types';
import { isTerminalStatus } from './status';

/** Coerce an ISO string or Date into epoch milliseconds. */
function toMillis(value: IsoDateTime | IsoDate | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Whether a session has passed its `expires_at` instant.
 *
 * `now` is injected (not read from the clock) so this stays pure and testable.
 */
export function isSessionExpired(
  expiresAt: IsoDateTime | Date,
  now: IsoDateTime | Date,
): boolean {
  return toMillis(now) >= toMillis(expiresAt);
}

/**
 * Whether a document is expired relative to `now`.
 *
 * Expiry is treated as end-of-day: a document expiring on `now`'s date is still
 * valid that day. Returns `false` when no expiry date is known.
 */
export function isDocumentExpired(
  expiryDate: IsoDate | null | undefined,
  now: IsoDateTime | Date,
): boolean {
  if (!expiryDate) return false;
  const expiryEndOfDay = new Date(`${expiryDate}T23:59:59.999Z`).getTime();
  if (Number.isNaN(expiryEndOfDay)) return false;
  return toMillis(now) > expiryEndOfDay;
}

/**
 * Whether a session in `status` should be auto-expired given its `expires_at`.
 * Terminal sessions are never re-expired.
 */
export function shouldExpireSession(
  status: VerificationStatus,
  expiresAt: IsoDateTime | Date,
  now: IsoDateTime | Date,
): boolean {
  if (isTerminalStatus(status)) return false;
  return isSessionExpired(expiresAt, now);
}
