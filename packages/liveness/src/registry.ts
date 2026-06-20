import type { LivenessConfig, LivenessDriver } from './types';
import { MockLivenessDriver } from './drivers/mock';
import { InternalLivenessDriver } from './drivers/internal';
import { ExternalLivenessDriver } from './drivers/external';

/** Resolve the liveness driver named by `config`. */
export function createLivenessDriver(config: LivenessConfig): LivenessDriver {
  switch (config.driver) {
    case 'mock':
      return new MockLivenessDriver();
    case 'internal':
      return new InternalLivenessDriver();
    case 'external':
      return new ExternalLivenessDriver(config);
    default:
      throw new Error(`Unknown liveness driver: ${(config as LivenessConfig).driver}`);
  }
}
