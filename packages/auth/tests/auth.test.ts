import { describe, expect, it } from 'vitest';
import {
  apiKeyPrefix,
  createClientToken,
  createTokenPair,
  generateApiKey,
  generateToken,
  hashPassword,
  hashToken,
  isClientTokenValid,
  safeEqualHex,
  sha256,
  verifyApiKey,
  verifyPassword,
  verifyToken,
} from '../src/index';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a unique salt per hash', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$a$b')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('tokens', () => {
  it('generates random, url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes and verifies tokens in constant time', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken(token, hash)).toBe(true);
    expect(verifyToken('other', hash)).toBe(false);
  });

  it('createTokenPair returns matching token and hash', () => {
    const { token, tokenHash } = createTokenPair();
    expect(tokenHash).toBe(sha256(token));
    expect(verifyToken(token, tokenHash)).toBe(true);
  });

  it('safeEqualHex handles unequal lengths without throwing', () => {
    expect(safeEqualHex('ab', 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
    expect(safeEqualHex(sha256('x'), sha256('x'))).toBe(true);
  });
});

describe('api keys', () => {
  it('generates a secret, prefix, and hash that verify', () => {
    const key = generateApiKey('live');
    expect(key.secret.startsWith('sk_live_')).toBe(true);
    expect(key.keyPrefix).toBe(apiKeyPrefix(key.secret));
    expect(key.keyPrefix.length).toBe(12);
    expect(verifyApiKey(key.secret, key.keyHash)).toBe(true);
    expect(verifyApiKey('sk_live_tampered', key.keyHash)).toBe(false);
  });

  it('marks test-environment keys', () => {
    expect(generateApiKey('test').secret.startsWith('sk_test_')).toBe(true);
  });
});

describe('client tokens', () => {
  const now = new Date('2026-06-20T00:00:00.000Z');

  it('mints a token with the expected expiry', () => {
    const ct = createClientToken(900, now);
    expect(ct.expiresAt).toBe('2026-06-20T00:15:00.000Z');
    expect(verifyToken(ct.token, ct.tokenHash)).toBe(true);
  });

  it('accepts a valid, unexpired token and rejects expired or wrong ones', () => {
    const ct = createClientToken(900, now);
    const beforeExpiry = new Date('2026-06-20T00:10:00.000Z');
    const afterExpiry = new Date('2026-06-20T00:20:00.000Z');
    expect(isClientTokenValid(ct.token, ct.tokenHash, ct.expiresAt, beforeExpiry)).toBe(true);
    expect(isClientTokenValid(ct.token, ct.tokenHash, ct.expiresAt, afterExpiry)).toBe(false);
    expect(isClientTokenValid('wrong', ct.tokenHash, ct.expiresAt, beforeExpiry)).toBe(false);
  });
});
