import type { User } from '@arkyc/types'
import { CACHE, type Envelope, alova, unwrap } from './client'
import type { AuthResult } from './types'

/** Supported second factors. */
export type TwoFactorMethod = 'authenticator' | 'email'

/** The challenge a login returns when the account has 2FA enabled. */
export interface TwoFactorChallenge {
  required: boolean
  method: TwoFactorMethod | null
  ticket: string
}

/** A user's two-factor status. */
export interface TwoFactorStatus {
  enabled: boolean
  method: TwoFactorMethod | null
  recovery_codes_remaining: number
  enabled_at: string | null
}

/** Dashboard authentication (Arkstack built-in device-session auth). */
export class Auth {
  /** Register a new user; the issued JWT is persisted by the token interceptor. */
  static register(input: { firstname: string; lastname?: string; email: string; password: string }) {
    return alova.Post('/v1/auth/register', input, {
      name: 'auth:register',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult) => ({
        user: raw.data as User,
        token: raw.token as string,
      }),
    })
  }

  /**
   * Sign in with credentials. When the account has 2FA enabled the response
   * carries a `twoFactor` challenge (and no token) instead of a session; the
   * token interceptor only persists a JWT when one is actually present.
   */
  static login(input: { email: string; password: string }) {
    return alova.Post('/v1/auth/login', input, {
      name: 'auth:login',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult & { two_factor?: TwoFactorChallenge }) => ({
        user: raw.data as User,
        token: raw.token as string,
        twoFactor: raw.two_factor ?? null,
      }),
    })
  }

  /** Complete a two-factor login with the challenge ticket and a code (TOTP / emailed / recovery). */
  static loginTwoFactor(input: { ticket: string; code: string }) {
    return alova.Post('/v1/auth/login/2fa', input, {
      name: 'auth:login:2fa',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult) => ({
        user: raw.data as User,
        token: raw.token as string,
      }),
    })
  }

  /** Re-send the emailed login code for an in-progress challenge. */
  static resendLoginCode(input: { ticket: string }) {
    return alova.Post('/v1/auth/login/2fa/resend', input, { name: 'auth:login:2fa:resend' })
  }

  /** The currently authenticated user. */
  static me() {
    return alova.Get('/v1/auth/me', {
      name: 'auth:me',
      cacheFor: CACHE,
      // Refresh on sign-in only. NOT on logout: invalidating here would make the
      // still-mounted `me` request auto-refetch `/auth/me` with no token (a 401).
      hitSource: ['auth:login', 'auth:register'],
      transform: unwrap<User>,
    })
  }

  /** Sign out; the persisted JWT is dropped by the token interceptor. */
  static logout() {
    return alova.Delete<unknown>('/v1/auth/logout', undefined, {
      name: 'auth:logout',
      meta: { authRole: 'logout' },
    })
  }

  /** Request a password-reset code/link for an email (no auth). */
  static forgotPassword(input: { email: string }) {
    return alova.Post('/v1/auth/forgot', input, { name: 'auth:forgot' })
  }

  /** Check that a reset token is still valid (no auth). */
  static verifyResetToken(token: string) {
    return alova.Get(`/v1/auth/forgot/${encodeURIComponent(token)}`, { name: 'auth:forgot:verify' })
  }

  /** Consume a reset token and set a new password (no auth). */
  static resetPassword(token: string, input: { password: string }) {
    return alova.Put(`/v1/auth/forgot/${encodeURIComponent(token)}`, input, { name: 'auth:forgot:reset' })
  }

  /** Email the signed-in user a verification code. */
  static sendEmailVerification() {
    return alova.Post('/v1/auth/verify', { object: 'email' }, { name: 'auth:verify:send' })
  }

  /** Confirm an emailed verification code, marking the email verified. */
  static confirmEmailVerification(input: { code: string }) {
    return alova.Put('/v1/auth/verify/email', input, { name: 'auth:verify:confirm' })
  }

  /** The signed-in user's two-factor status. */
  static twoFactorStatus() {
    return alova.Get('/v1/auth/2fa', {
      name: 'auth:2fa:status',
      cacheFor: CACHE,
      hitSource: ['auth:2fa:confirm', 'auth:2fa:disable'],
      transform: unwrap<TwoFactorStatus>,
    })
  }

  /**
   * Begin 2FA enrollment for a method. Authenticator returns `{ secret, otpauth_url }`
   * to render as a QR; email sends a setup code. The payload sits under `two_factor`.
   */
  static setupTwoFactor(input: { method: TwoFactorMethod }) {
    return alova.Post('/v1/auth/2fa/setup', input, { name: 'auth:2fa:setup' })
  }

  /** Confirm enrollment with a code; the response carries one-time `recovery_codes`. */
  static confirmTwoFactor(input: { method: TwoFactorMethod; code: string }) {
    return alova.Post('/v1/auth/2fa/confirm', input, { name: 'auth:2fa:confirm' })
  }

  /** Disable 2FA after re-confirming the account password. */
  static disableTwoFactor(input: { password: string }) {
    return alova.Delete('/v1/auth/2fa', input, { name: 'auth:2fa:disable' })
  }
}
