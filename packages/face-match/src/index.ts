/**
 * @arkyc/face-match
 *
 * Driver-based face matching. Drivers (`mock`, `internal`, `external`) share the
 * {@link FaceMatchDriver} interface; {@link createFaceMatchDriver} selects one
 * from config so call sites stay driver-agnostic.
 */
export * from './types';
export * from './registry';
export { MockFaceMatchDriver } from './drivers/mock';
export { InternalFaceMatchDriver } from './drivers/internal';
export { ExternalFaceMatchDriver } from './drivers/external';
