import { type AssetKind, clampAssetTtl, signedAssetUrl } from 'src/support/asset-url'

import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { VerificationSession } from '@app/models/VerificationSession'
import { settings } from '@app/services/GlobalSettingsService'

/**
 * Signed inline-image URLs for whichever assets a session has captured so far.
 *
 * @param session
 * @returns
 */
export async function buildSessionAssets(session: VerificationSession): Promise<Partial<Record<AssetKind, string>>> {
  const assets: Partial<Record<AssetKind, string>> = {}
  // Mint each link with the platform-configured lifetime (clamped for safety);
  // the expiry is embedded in the URL, so no verification-side change is needed.
  const ttl = clampAssetTtl((await settings.current()).assets.url_ttl_seconds)

  const capture = await DocumentCapture.where({ sessionId: session.id }).first()

  if (capture?.frontImagePath)
    assets.document_front = signedAssetUrl(session.id, 'document_front', ttl)

  if (capture?.backImagePath)
    assets.document_back = signedAssetUrl(session.id, 'document_back', ttl)

  const liveness = await LivenessCheck.where({ sessionId: session.id }).first()

  if (liveness?.selfieImagePath)
    assets.selfie = signedAssetUrl(session.id, 'selfie', ttl)

  return assets
}

/**
 * Resolve the stored object key for an asset kind on a
 * session, or null if absent.
 *
 * @param session
 * @param kind
 * @returns
 */
export async function assetObjectKey(session: VerificationSession, kind: AssetKind): Promise<string | null> {
  switch (kind) {
    case 'document_front':
      return (await DocumentCapture.where({ sessionId: session.id }).first())?.frontImagePath ?? null
    case 'document_back':
      return (await DocumentCapture.where({ sessionId: session.id }).first())?.backImagePath ?? null
    case 'selfie':
      return (await LivenessCheck.where({ sessionId: session.id }).first())?.selfieImagePath ?? null
  }
}
