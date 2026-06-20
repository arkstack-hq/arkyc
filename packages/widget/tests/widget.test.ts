import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from '../src/index';

describe('widget', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkyc/widget');
  });
});
