/**
 * @arkyc/liveness
 *
 * Driver-based passive liveness detection. Drivers (`mock`, `external`) share
 * the {@link LivenessDriver} interface; {@link createLivenessDriver} selects one
 * from config so call sites stay driver-agnostic. Point `external` at any
 * liveness HTTP service (e.g. a self-hosted model server).
 */
export * from './types'
export * from './registry'
export { MockLivenessDriver } from './drivers/mock'
export { ExternalLivenessDriver } from './drivers/external'
