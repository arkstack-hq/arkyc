import { describe, expect, it } from 'vitest'
import { ApiKey, ClientToken, Password, Token } from '../src/index'

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await Password.hash('correct horse battery staple')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await Password.verify('correct horse battery staple', hash)).toBe(true)
    expect(await Password.verify('wrong password', hash)).toBe(false)
  })

  it('produces a unique salt per hash', async () => {
    const a = await Password.hash('same')
    const b = await Password.hash('same')
    expect(a).not.toBe(b)
    expect(await Password.verify('same', a)).toBe(true)
    expect(await Password.verify('same', b)).toBe(true)
  })

  it('rejects malformed stored hashes', async () => {
    expect(await Password.verify('x', 'not-a-hash')).toBe(false)
    expect(await Password.verify('x', 'bcrypt$1$a$b')).toBe(false)
    expect(await Password.verify('x', '')).toBe(false)
  })
})

describe('tokens', () => {
  it('generates random, url-safe tokens', () => {
    const a = Token.generate()
    const b = Token.generate()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashes and verifies tokens in constant time', () => {
    const token = Token.generate()
    const hash = Token.hash(token)
    expect(Token.verify(token, hash)).toBe(true)
    expect(Token.verify('other', hash)).toBe(false)
  })

  it('createPair returns matching token and hash', () => {
    const { token, tokenHash } = Token.createPair()
    expect(tokenHash).toBe(Token.sha256(token))
    expect(Token.verify(token, tokenHash)).toBe(true)
  })

  it('safeEqualHex handles unequal lengths without throwing', () => {
    expect(Token.safeEqualHex('ab', 'abcd')).toBe(false)
    expect(Token.safeEqualHex('', '')).toBe(false)
    expect(Token.safeEqualHex(Token.sha256('x'), Token.sha256('x'))).toBe(true)
  })
})

describe('api keys', () => {
  it('generates a secret, prefix, and hash that verify', () => {
    const key = ApiKey.generate('live')
    expect(key.secret.startsWith('sk_live_')).toBe(true)
    expect(key.keyPrefix).toBe(ApiKey.prefix(key.secret))
    expect(key.keyPrefix.length).toBe(12)
    expect(ApiKey.verify(key.secret, key.keyHash)).toBe(true)
    expect(ApiKey.verify('sk_live_tampered', key.keyHash)).toBe(false)
  })

  it('marks test-environment keys', () => {
    expect(ApiKey.generate('test').secret.startsWith('sk_test_')).toBe(true)
  })
})

describe('client tokens', () => {
  const now = new Date('2026-06-20T00:00:00.000Z')

  it('mints a token with the expected expiry', () => {
    const ct = ClientToken.create(900, now)
    expect(ct.expiresAt).toBe('2026-06-20T00:15:00.000Z')
    expect(Token.verify(ct.token, ct.tokenHash)).toBe(true)
  })

  it('uses a default ttl of 15 minutes', () => {
    expect(ClientToken.DEFAULT_TTL_SECONDS).toBe(15 * 60)
    const ct = ClientToken.create(undefined, now)
    expect(ct.expiresAt).toBe('2026-06-20T00:15:00.000Z')
  })

  it('accepts a valid, unexpired token and rejects expired or wrong ones', () => {
    const ct = ClientToken.create(900, now)
    const beforeExpiry = new Date('2026-06-20T00:10:00.000Z')
    const afterExpiry = new Date('2026-06-20T00:20:00.000Z')
    expect(ClientToken.isValid(ct.token, ct.tokenHash, ct.expiresAt, beforeExpiry)).toBe(true)
    expect(ClientToken.isValid(ct.token, ct.tokenHash, ct.expiresAt, afterExpiry)).toBe(false)
    expect(ClientToken.isValid('wrong', ct.tokenHash, ct.expiresAt, beforeExpiry)).toBe(false)
  })
})
