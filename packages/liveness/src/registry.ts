import type { LivenessConfig, LivenessDriver } from './types';
import { MockLivenessDriver } from './drivers/mock';
import { ExternalLivenessDriver } from './drivers/external';

/** Selects a liveness driver from config. */
export class LivenessDriverFactory {
  /** Resolve the liveness driver named by `config`. */
  static create(config: LivenessConfig): LivenessDriver {
    switch (config.driver) {
      case 'mock':
        return new MockLivenessDriver();
      case 'external':
        return new ExternalLivenessDriver(config);
      default:
        throw new Error(`Unknown liveness driver: ${(config as LivenessConfig).driver}`);
    }
  }
}
