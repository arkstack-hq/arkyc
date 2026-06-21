import type { Method } from 'alova';
import { SecureStorage } from '@/lib/Storage/SecureStorage';

const rateLimitPreferencePrefix = 'requestRateLimit:';
const toPreferenceKey = (rateLimitKey: string) => `${rateLimitPreferencePrefix}${encodeURIComponent(rateLimitKey)}`;
const toRateLimitKey = (methodType: string, url: string) => `${methodType.toUpperCase()} ${url}`;

export function buildRateLimitKey(methodType: string, url: string) {
  return toRateLimitKey(methodType, url);
}

export function getRetryAfterSeconds(headers?: Headers) {
  const retryAfter = Number.parseInt(headers?.get('retry-after') ?? '', 10);
  return Number.isNaN(retryAfter) || retryAfter <= 0
    ? undefined
    : retryAfter;
}

export async function setStoredRateLimit(rateLimitKey: string, seconds: number) {
  const preferenceKey = toPreferenceKey(rateLimitKey);

  if (seconds <= 0) {
    await SecureStorage.remove(preferenceKey);
    return;
  }

  await SecureStorage.set(preferenceKey, String(Date.now() + seconds * 1000));
}

export async function setStoredRateLimitForRequest(
  methodType: string,
  url: string,
  seconds: number,
) {
  await setStoredRateLimit(buildRateLimitKey(methodType, url), seconds);
}

export async function getStoredRateLimit(rateLimitKey: string) {
  const preferenceKey = toPreferenceKey(rateLimitKey);
  const value = await SecureStorage.get(preferenceKey);

  if (!value) {
    return 0;
  }

  const expiresAt = Number.parseInt(String(value), 10);
  const remainingSeconds = Number.isNaN(expiresAt)
    ? 0
    : Math.ceil((expiresAt - Date.now()) / 1000);

  if (remainingSeconds <= 0) {
    await SecureStorage.remove(preferenceKey);
    return 0;
  }

  return remainingSeconds;
}

export async function getStoredRateLimitForRequest(
  methodType: string,
  url: string,
) {
  return getStoredRateLimit(buildRateLimitKey(methodType, url));
}

export async function persistRateLimitFromResponse(
  method: Pick<Method, 'type' | 'url'>,
  headers?: Headers,
) {
  const seconds = getRetryAfterSeconds(headers);
  if (!seconds) {
    return;
  }

  await setStoredRateLimit(toRateLimitKey(String(method.type), method.url), seconds);
}
