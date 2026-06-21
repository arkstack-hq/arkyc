/**
 * @arkyc/face-match
 *
 * Driver-based face matching. Drivers (`mock`, `external`) share the
 * {@link FaceMatchDriver} interface; {@link createFaceMatchDriver} selects one
 * from config so call sites stay driver-agnostic. Point `external` at any
 * face-match HTTP service (e.g. a self-hosted model server).
 */
export * from './types'
export * from './registry'
export { MockFaceMatchDriver } from './drivers/mock'
export { ExternalFaceMatchDriver } from './drivers/external'
