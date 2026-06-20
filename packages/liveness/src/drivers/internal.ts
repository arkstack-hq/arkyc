import type { LivenessResultData } from '@arkyc/types';
import type { LivenessDriver, LivenessRequest } from '../types';

/**
 * Internal (self-hosted model) liveness driver.
 *
 * Placeholder: the in-house detection model is integrated with the deployment
 * work. Registered so `LIVENESS_DRIVER=internal` resolves, but throws until
 * implemented rather than silently passing.
 */
export class InternalLivenessDriver implements LivenessDriver {
  readonly name = 'internal';

  async check(_request: LivenessRequest): Promise<LivenessResultData> {
    throw new Error('InternalLivenessDriver is not yet implemented');
  }
}
