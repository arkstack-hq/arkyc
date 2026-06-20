import type { FaceMatchResultData } from '@arkyc/types';
import type { FaceMatchDriver, FaceMatchRequest } from '../types';

/**
 * Internal (self-hosted model) face-match driver.
 *
 * Placeholder: the in-house embedding/compare model is integrated with the
 * deployment work. Registered so `FACE_MATCH_DRIVER=internal` resolves, but
 * throws until implemented rather than silently passing.
 */
export class InternalFaceMatchDriver implements FaceMatchDriver {
  readonly name = 'internal';

  async compare(_request: FaceMatchRequest): Promise<FaceMatchResultData> {
    throw new Error('InternalFaceMatchDriver is not yet implemented');
  }
}
