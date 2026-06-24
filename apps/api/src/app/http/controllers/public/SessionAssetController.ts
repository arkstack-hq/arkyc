import { type AssetKind, verifyAssetSignature } from 'src/support/asset-url'

import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { VerificationSession } from '@app/models/VerificationSession'
import { assetObjectKey } from '@app/services/SessionAssetService'
import { readObject } from 'src/support/storage'

const str = (value: unknown): string => (Array.isArray(value) ? String(value[0] ?? '') : String(value ?? ''))

/**
 * Serves a single captured session asset over a signed, time-limited link (no
 * API key). The signature commits to the session, kind, and expiry, so the URL
 * can be handed to a third party. The image is served inline (`Content-Disposition:
 * inline`) so it renders in a browser/`<img>` rather than triggering a download.
 */
export default class SessionAssetController extends BaseController {
  async show({ req, res }: HttpContext) {
    const id = str(req.params.id)
    const kind = str(req.params.kind)

    if (!verifyAssetSignature(id, kind, req.query.expires, str(req.query.signature))) {
      return res.status(403).json({ status: 'error', message: 'Invalid or expired asset link', code: 403 })
    }

    const session = await VerificationSession.where({ id }).first()
    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found', code: 404 })
    }

    const key = await assetObjectKey(session, kind as AssetKind)
    const bytes = await readObject(key)
    if (!bytes.length) {
      return res.status(404).json({ status: 'error', message: 'Asset not found', code: 404 })
    }

    return res
      .status(200)
      .set('Content-Type', 'image/jpeg')
      .set('Cache-Control', 'private, max-age=300')
      .send(Buffer.from(bytes))
  }
}
