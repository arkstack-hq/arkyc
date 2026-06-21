/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleUnauthorized } from './auth-session'

import ReactHook from 'alova/react'
import { RequestException } from '../Exceptions/RequestException'
import { SecureStorage } from '../Storage/SecureStorage'
import { ValidationException } from '../Exceptions/ValidationException'
import adapterFetch from 'alova/fetch'
import { createAlova, type Method } from 'alova'
import { createClientTokenAuthentication } from 'alova/client'
import { persistRateLimitFromResponse } from './rate-limit'
import type { GenericApiResponsePayload } from '@/types/core'
import { env } from '@/config/environment'

/** localStorage key the dashboard JWT is persisted under. */
export const AUTH_TOKEN_KEY = 'arkyc:authToken'

function normaliseErrorPayload(payload: any, response: Response): GenericApiResponsePayload {
  return {
    status: typeof payload?.status === 'string' ? payload.status : 'error',
    code: typeof payload?.code === 'number' ? payload.code : response.status,
    message:
      typeof payload?.message === 'string'
        ? payload.message
        : response.statusText || 'Request failed',
    errors: payload?.errors,
  }
}

async function ResponseHandler<T>(response: Response, method: Method<any>): Promise<any> {
  if (response.status === 204) return { data: undefined as T }

  // Read the body exactly once — a Response's stream can't be re-read or
  // cloned after consumption (`clone()` throws "body is already used").
  const payload = await response.json().catch(() => null)
  const data = normaliseErrorPayload(payload, response)

  if (response.status === 422) {
    const { message = '', errors = {} } = data || {}
    throw new ValidationException(message, errors, response.status)
  } else if (response.status === 401) {
    if (method.config.meta?.handle401 !== 'local') {
      await handleUnauthorized()
    }

    throw new RequestException(data.message || 'Session expired', response.status, response.headers)
  } else if (response.status >= 400) {
    if (response.status === 429) {
      await persistRateLimitFromResponse(method, response.headers)
    }

    throw new RequestException(data.message, response.status, response.headers)
  }

  return payload
}

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<
  typeof ReactHook,
  typeof adapterFetch
>({
  // Persist the token from a login/register response (matched by method meta
  // `authRole: 'login'`). Read a clone so `ResponseHandler` can still read the body.
  login: {
    async handler(response) {
      try {
        const payload = await response.clone().json()
        if (payload?.token) await SecureStorage.set(AUTH_TOKEN_KEY, payload.token)
      } catch {
        /* non-JSON / no token in body — nothing to persist */
      }
    },
  },
  // Drop the token on a logout request (matched by `authRole: 'logout'`).
  logout: {
    async handler() {
      await SecureStorage.remove(AUTH_TOKEN_KEY)
    },
  },
  // Attach the bearer to every authenticated request; login/logout requests skip it.
  async assignToken(method) {
    const token = await SecureStorage.get<string>(AUTH_TOKEN_KEY)
    if (token) method.config.headers.Authorization = `Bearer ${token}`
  },
  visitorMeta: {
    isVisitor: true,
  },
})

const alovaInstance = createAlova({
  requestAdapter: adapterFetch(),
  baseURL: env('VITE_API_URL', '') + '/api',
  statesHook: ReactHook,
  beforeRequest: onAuthRequired((method) => {
    method.config.headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...method.config.headers,
    }
  }),
  responded: onResponseRefreshToken({
    onSuccess: ResponseHandler,
    onError: ResponseHandler,
  }),
})

export const alova = alovaInstance
