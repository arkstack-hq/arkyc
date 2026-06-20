import type { FaceMatchConfig, FaceMatchDriver } from './types';
import { MockFaceMatchDriver } from './drivers/mock';
import { InternalFaceMatchDriver } from './drivers/internal';
import { ExternalFaceMatchDriver } from './drivers/external';

/** Resolve the face-match driver named by `config`. */
export function createFaceMatchDriver(config: FaceMatchConfig): FaceMatchDriver {
  switch (config.driver) {
    case 'mock':
      return new MockFaceMatchDriver();
    case 'internal':
      return new InternalFaceMatchDriver();
    case 'external':
      return new ExternalFaceMatchDriver(config);
    default:
      throw new Error(`Unknown face-match driver: ${(config as FaceMatchConfig).driver}`);
  }
}
