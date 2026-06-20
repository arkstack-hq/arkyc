/**
 * @arkyc/liveness
 *
 * Driver-based passive liveness detection. Drivers (`mock`, `internal`,
 * `external`) share the {@link LivenessDriver} interface; {@link createLivenessDriver}
 * selects one from config so call sites stay driver-agnostic.
 */
export * from './types';
export * from './registry';
export { MockLivenessDriver } from './drivers/mock';
export { InternalLivenessDriver } from './drivers/internal';
export { ExternalLivenessDriver } from './drivers/external';
