import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from '../src/index.js';

describe('types', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/types');
  });
});
