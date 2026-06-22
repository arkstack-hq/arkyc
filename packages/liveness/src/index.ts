/**
 * @arkyc/liveness
 *
 * Driver-based liveness detection — passive (selfie) and active (challenge
 * video). Drivers (`mock`, `external`) share the {@link LivenessDriver}
 * interface; {@link LivenessDriverFactory} selects one from config so call sites
 * stay driver-agnostic. Point `external` at any liveness HTTP service.
 */
export * from './types'
export * from './registry'
export * from './challenges'
export { MockLivenessDriver } from './drivers/mock'
export { ExternalLivenessDriver } from './drivers/external'
