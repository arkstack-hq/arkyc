import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('face-match', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/face-match');
  });
});
