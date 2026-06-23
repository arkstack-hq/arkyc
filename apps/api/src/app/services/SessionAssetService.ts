import { type AssetKind, signedAssetUrl } from 'src/support/asset-url'

import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { VerificationSession } from '@app/models/VerificationSession'

/** Signed inline-image URLs for whichever assets a session has captured so far. */
export async function buildSessionAssets(session: VerificationSession): Promise<Partial<Record<AssetKind, string>>> {
  const assets: Partial<Record<AssetKind, string>> = {}

  const capture = await DocumentCapture.where({ sessionId: session.id }).first()
  if (capture?.frontImagePath) assets.document_front = signedAssetUrl(session.id, 'document_front')
  if (capture?.backImagePath) assets.document_back = signedAssetUrl(session.id, 'document_back')

  const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
  if (liveness?.selfieImagePath) assets.selfie = signedAssetUrl(session.id, 'selfie')

  return assets
}

/** Resolve the stored object key for an asset kind on a session, or null if absent. */
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
