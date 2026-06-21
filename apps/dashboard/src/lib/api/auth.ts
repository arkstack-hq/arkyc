import type { User } from '@arkyc/types'
import { CACHE, type Envelope, alova, unwrap } from './client'
import type { AuthResult } from './types'

/** Dashboard authentication (Arkstack built-in device-session auth). */
export class Auth {
  /** Register a new user; the issued JWT is persisted by the token interceptor. */
  static register(input: { name: string; email: string; password: string }) {
    return alova.Post('/v1/auth/register', input, {
      name: 'auth:register',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult) => ({ user: raw.data as User, token: raw.token as string }),
    })
  }

  /** Sign in with credentials; the issued JWT is persisted by the token interceptor. */
  static login(input: { email: string; password: string }) {
    return alova.Post('/v1/auth/login', input, {
      name: 'auth:login',
      meta: { authRole: 'login' },
      transform: (raw: Envelope<User> & AuthResult) => ({ user: raw.data as User, token: raw.token as string }),
    })
  }

  /** The currently authenticated user. */
  static me() {
    return alova.Get('/v1/auth/me', {
      name: 'auth:me',
      cacheFor: CACHE,
      hitSource: ['auth:login', 'auth:register', 'auth:logout'],
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
}
