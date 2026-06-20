import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('liveness', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/liveness');
  });
});
