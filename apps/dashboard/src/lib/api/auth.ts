import type { User } from '@arkyc/types'
import { CACHE, type Envelope, alova, unwrap } from './client'
import type { AuthResult } from './types'

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

  /** Sign in with credentials; the issued JWT is persisted by the token interceptor. */
  static login(input: { email: string; password: string }) {
    return alova.Post('/v1/auth/login', input, {
      name: 'auth:login',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult) => ({
        user: raw.data as User,
        token: raw.token as string,
      }),
    })
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
}
