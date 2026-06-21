/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleUnauthorized } from './auth-session';

import ReactHook, { type ReactState } from 'alova/react';
import { RequestException } from '../Exceptions/RequestException';
import { ValidationException } from '../Exceptions/ValidationException';
import { axiosRequestAdapter, type AlovaAxiosRequestConfig } from '@alova/adapter-axios';
import { createAlova, Method, type AlovaDefaultCacheAdapter, type AlovaGenerics } from 'alova';
import { env } from '@/config/environment';
import { persistRateLimitFromResponse } from './rate-limit';
import { type AxiosResponse, type AxiosResponseHeaders } from 'axios';
import { createClientTokenAuthentication } from 'alova/client';
import type reactHook from 'alova/react';
import { SecureStorage } from '../Storage/SecureStorage';

async function readErrorMessage(response: AxiosResponse) {
  try {
    const { message = '' } = response.data || {};
    return message;
  } catch {
    return response.statusText || 'Request failed';
  }
}

const ResponseHandler = async (res: AxiosResponse<any>, method: Method<AlovaGenerics<any, any, AlovaAxiosRequestConfig, AxiosResponse<any>, AxiosResponseHeaders, AlovaDefaultCacheAdapter, AlovaDefaultCacheAdapter, {
  name: "React";
  State: ReactState<unknown>;
  Computed: any[];
  Watched: unknown;
  StateExport: unknown;
  ComputedExport: unknown;
}>>) => {
  const headers = new Headers(
    (res as any).response?.headers ?? res.headers as Record<string, string>
  )

  await persistRateLimitFromResponse(method, headers);
  if (res.status === 422) {
    const { message = '', errors = {} } = (res as any).response?.data || {};
    throw new ValidationException(message, errors, res.status);
  } else if (res.status === 401) {
    const message = await readErrorMessage((res as any).response);

    if (method.config.meta?.handle401 !== 'local') {
      await handleUnauthorized();
    }

    throw new RequestException(message || 'Session expired', res.status, headers);
  } else if (res.status >= 400) {
    if (res.status === 429) {
      await persistRateLimitFromResponse(method, headers);
    }

    const message = await readErrorMessage((res as any).response);
    throw new RequestException(message, res.status, headers);
  }

  return res.data || {};
}

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<
  typeof reactHook,
  typeof axiosRequestAdapter
>({
  // Persist the token from a login/register response (matched by `authRole: 'login'`).
  login: {
    handler(response) {
      if (response?.data?.token) SecureStorage.set('arkyc:authToken', response.data.token);
    },
  },
  // Drop the token on a logout request (matched by `authRole: 'logout'`).
  logout: {
    handler() {
      SecureStorage.remove('arkyc:authToken')
    },
  },
  // Attach the bearer to every authenticated request; login/logout requests skip it.
  assignToken(method) {
    const token = SecureStorage.get('arkyc:authToken')
    if (token) method.config.headers.Authorization = `Bearer ${token}`;
  },
  visitorMeta: {
    isVisitor: true
  },
});

const alovaInstance = createAlova({
  requestAdapter: axiosRequestAdapter(),
  baseURL: env('VITE_API_URL', 'http://localhost:3000/'),
  statesHook: ReactHook,
  l1Cache: SecureStorage,
  l2Cache: SecureStorage,
  beforeRequest: onAuthRequired((method) => {
    method.config.headers = {
      Accept: 'application/json',
      ...method.config.headers,
    };
  }),
  responded: onResponseRefreshToken({
    onSuccess: ResponseHandler,
    onError: ResponseHandler
  }),
});

alovaInstance.options.beforeRequest = async (method) => {
  method.config.headers ??= {};
  method.config.headers['Access-Control-Allow-Credentials'] = 'true';
  method.config.headers['X-Requested-With'] = 'XMLHttpRequest';
  method.config.headers['Accept'] = 'application/json';
  method.config.headers['Content-Type'] = 'multipart/form-data';
}

export const axios = alovaInstance;
