import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from '../src/index';

describe('face-match', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/face-match');
  });
});
