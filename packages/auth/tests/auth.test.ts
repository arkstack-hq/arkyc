import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from '../src/index.js';

describe('auth', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/auth');
  });
});
