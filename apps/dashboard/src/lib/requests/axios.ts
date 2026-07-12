 
import { handleUnauthorized } from './auth-session'

import ReactHook, { type ReactState } from 'alova/react'
import { RequestException } from '../Exceptions/RequestException'
import { ValidationException } from '../Exceptions/ValidationException'
import { axiosRequestAdapter, type AlovaAxiosRequestConfig } from '@alova/adapter-axios'
import { createAlova, Method, type AlovaDefaultCacheAdapter, type AlovaGenerics } from 'alova'
import { env } from '@/config/environment'
import { persistRateLimitFromResponse } from './rate-limit'
import { type AxiosResponse, type AxiosResponseHeaders } from 'axios'
import { createClientTokenAuthentication } from 'alova/client'
import type reactHook from 'alova/react'
import { SecureStorage } from '../Storage/SecureStorage'

function readErrorMessage(data: any, statusText?: string) {
  const message = data?.message
  return typeof message === 'string' && message ? message : statusText || 'Request failed'
}

const ResponseHandler = async (
  res: AxiosResponse<any>,
  method: Method<
    AlovaGenerics<
      any,
      any,
      AlovaAxiosRequestConfig,
      AxiosResponse<any>,
      AxiosResponseHeaders,
      AlovaDefaultCacheAdapter,
      AlovaDefaultCacheAdapter,
      {
        name: 'React'
        State: ReactState<unknown>
        Computed: any[]
        Watched: unknown
        StateExport: unknown
        ComputedExport: unknown
      }
    >
  >,
) => {
  // alova hands us an `AxiosResponse` on success but an `AxiosError` on failure;
  // the real response (status/data/headers) sits on `.response` for the latter.
  // Normalise to a single shape so each branch reads from the same place.
  const axiosRes = (res as any).response ?? res
  const status: number = axiosRes.status ?? (res as any).status
  const data = axiosRes.data
  const headers = new Headers(axiosRes.headers as Record<string, string>)

  await persistRateLimitFromResponse(method, headers)
  if (status === 422) {
    const { message = '', errors = {} } = data || {}
    throw new ValidationException(message, errors, status)
  } else if (status === 401) {
    const message = readErrorMessage(data, axiosRes.statusText)

    if (method.config.meta?.handle401 !== 'local') {
      await handleUnauthorized()
    }

    throw new RequestException(message || 'Session expired', status, headers)
  } else if (status >= 400) {
    if (status === 429) {
      await persistRateLimitFromResponse(method, headers)
    }

    const message = readErrorMessage(data, axiosRes.statusText)
    throw new RequestException(message, status, headers)
  }

  return data || {}
}

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<
  typeof reactHook,
  typeof axiosRequestAdapter
>({
  // Persist the token from a login/register response (matched by `authRole: 'login'`).
  login: {
    async handler(response) {
      if (response?.data?.token) await SecureStorage.set('arkyc:authToken', response.data.token)
    },
  },
  // Drop the token on a logout request (matched by `authRole: 'logout'`).
  logout: {
    async handler() {
      await SecureStorage.remove('arkyc:authToken')
    },
  },
  // Attach the bearer to every authenticated request; login/logout requests skip it.
  async assignToken(method) {
    const token = await SecureStorage.get('arkyc:authToken')
    if (token) method.config.headers.Authorization = `Bearer ${token}`
  },
  visitorMeta: {
    isVisitor: true,
  },
})

const alovaInstance = createAlova({
  requestAdapter: axiosRequestAdapter(),
  baseURL: env('VITE_API_URL', '') + '/api',
  statesHook: ReactHook,
  beforeRequest: onAuthRequired((method) => {
    method.config.headers = {
      Accept: 'application/json',
      ...method.config.headers,
    }
  }),
  responded: onResponseRefreshToken({
    onSuccess: ResponseHandler,
    onError: ResponseHandler,
  }),
})

alovaInstance.options.beforeRequest = async (method) => {
  method.config.headers ??= {}
  method.config.headers['Access-Control-Allow-Credentials'] = 'true'
  method.config.headers['X-Requested-With'] = 'XMLHttpRequest'
  method.config.headers['Accept'] = 'application/json'
  method.config.headers['Content-Type'] = 'multipart/form-data'
}

export const axios = alovaInstance
