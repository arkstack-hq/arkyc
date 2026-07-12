import type { RequestHandler } from 'express'
import { limiter } from '@arkstack/driver-express/middlewares'

/**
 * Shared rate limiters (Phase 20 hardening). Built on the driver's `limiter`
 * helper (IP-keyed `express-rate-limit`, throws `RateLimitExceededException` →
 * HTTP 429). The second argument is the window in **seconds**; the driver forces
 * a 30s window outside production, so these thresholds only fully apply in prod.
 *
 * Each export is a single instance so every route sharing it shares one bucket.
 * They gate the sensitive, mostly unauthenticated surfaces — credential entry,
 * the API-key session API, and outbound webhook test deliveries. The token-gated
 * widget/client API is intentionally left unthrottled here (IP-keying it would
 * penalise NAT'd/corporate traffic; it needs a token-keyed strategy instead).
 */

/**
 *  Under test, requests share one IP and hammer these endpoints — the counters would
 *  trip and mask real assertions, so limiting is a no-op there (still live in dev/prod). */
const testEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
const passthrough: RequestHandler = (_req, _res, next) => next()
const make = (req: number, winSec: number, msg: string):
  RequestHandler => testEnv ? passthrough : limiter(req, winSec, msg)

/**
 * Credential-entry endpoints (login, 2FA verify): tight, to blunt brute force.
 */
export const loginLimiter = make(10, 900, 'Too many attempts. Please try again later.')

/**
 * Other auth endpoints (register, forgot-password, email verify): moderate.
 */
export const authLimiter = make(30, 900, 'Too many requests. Please try again shortly.')

/**
 * Public API-key session endpoints: per-IP ceiling above normal integration use.
 */
export const apiLimiter = make(120, 60, 'Rate limit exceeded. Please slow down.')

/**
 * Outbound webhook test deliveries: tight, to curb using them to hammer a target URL.
 */
export const webhookTestLimiter = make(10, 900, 'Too many test deliveries. Please wait a moment.')
