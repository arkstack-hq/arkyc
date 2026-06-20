import type { LivenessConfig, LivenessDriver } from './types';
import { MockLivenessDriver } from './drivers/mock';
import { ExternalLivenessDriver } from './drivers/external';

/** Resolve the liveness driver named by `config`. */
export function createLivenessDriver(config: LivenessConfig): LivenessDriver {
  switch (config.driver) {
    case 'mock':
      return new MockLivenessDriver();
    case 'external':
      return new ExternalLivenessDriver(config);
    default:
      throw new Error(`Unknown liveness driver: ${(config as LivenessConfig).driver}`);
  }
}
