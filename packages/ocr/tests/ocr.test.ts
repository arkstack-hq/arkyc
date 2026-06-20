import { describe, expect, it } from 'vitest';
import { MockOcrDriver, createOcrDriver } from '../src/index';

const image = new Uint8Array([1, 2, 3]);

describe('ocr', () => {
  it('mock driver extracts deterministic fields', async () => {
    const driver = createOcrDriver({ driver: 'mock' });
    const result = await driver.extract({ image });
    expect(result.fields.fullName).toBe('Ada Lovelace');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('hints steer confidence and expiry', async () => {
    const result = await new MockOcrDriver().extract({
      image,
      hints: { confidence: 0.2, expired: true },
    });
    expect(result.confidence).toBe(0.2);
    expect(result.fields.expiryDate).toBe('2000-01-01');
  });

  it('requires an endpoint for the external driver', () => {
    expect(() => createOcrDriver({ driver: 'external' })).toThrow(/endpoint/);
  });
});
