import { createHmac, timingSafeEqual } from 'node:crypto'

/** How long a signed asset link stays valid. */
const ASSET_TTL_SECONDS = 60 * 30

/** The downloadable session assets. */
export type AssetKind = 'document_front' | 'document_back' | 'selfie'

const ASSET_KINDS: readonly AssetKind[] = ['document_front', 'document_back', 'selfie']

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value)
}

/**
 * HMAC over the tuple that a signed asset link commits to.
 *
 * @param sessionId
 * @param kind
 * @param expires
 * @returns
 */
function sign(sessionId: string, kind: AssetKind, expires: number): string {
  return createHmac('sha256', String(config('app.key')))
    .update(`${sessionId}.${kind}.${expires}`)
    .digest('hex')
}

/**
 * A public, time-limited URL for one session asset, served inline as an image
 * (no API key) — for handing captured images to a third party (e.g. when OCR is
 * skipped). The link is an HMAC over `(session, kind, expiry)` keyed by the app secret.
 *
 * @param sessionId
 * @param kind
 * @param ttlSeconds
 * @returns
 */
export function signedAssetUrl(sessionId: string, kind: AssetKind, ttlSeconds = ASSET_TTL_SECONDS): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const signature = sign(sessionId, kind, expires)
  const base = String(config('app.url')).replace(/\/$/, '')

  return `${base}/api/v1/session-assets/${sessionId}/${kind}?expires=${expires}&signature=${signature}`
}

/**
 * Validate a signed asset request: known kind, unexpired, and a matching HMAC.
 *
 * @param sessionId
 * @param kind
 * @param expiresRaw
 * @param signature
 * @returns
 */
export function verifyAssetSignature(sessionId: string, kind: string, expiresRaw: unknown, signature: string): boolean {
  if (!isAssetKind(kind)) return false

  const expires = Number(expiresRaw)
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false

  const expected = Buffer.from(sign(sessionId, kind, expires), 'hex')
  const provided = Buffer.from(String(signature), 'hex')

  return expected.length === provided.length && timingSafeEqual(expected, provided)
}
