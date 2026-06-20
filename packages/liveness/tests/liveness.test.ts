import { describe, expect, it } from 'vitest';
import { MockLivenessDriver, createLivenessDriver } from '../src/index';

const selfie = new Uint8Array([1, 2, 3]);

describe('liveness', () => {
  it('mock driver passes by default', async () => {
    const driver = createLivenessDriver({ driver: 'mock' });
    const result = await driver.check({ selfie });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('hints steer the score, verdict, and spoof signals', async () => {
    const result = await new MockLivenessDriver().check({
      selfie,
      hints: { score: 0.3, passed: false, multipleFaces: true },
    });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0.3);
    expect(result.spoofSignals.multipleFaces).toBe(true);
  });

  it('registers internal but defers its implementation', async () => {
    const driver = createLivenessDriver({ driver: 'internal' });
    await expect(driver.check({ selfie })).rejects.toThrow(/not yet implemented/);
  });

  it('requires an endpoint for the external driver', () => {
    expect(() => createLivenessDriver({ driver: 'external' })).toThrow(/endpoint/);
  });
});
