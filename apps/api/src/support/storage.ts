import type { ProjectBranding } from '@arkyc/types'
import { Storage } from '@arkstack/filesystem'
import { DEFAULT_ASSET_TTL_SECONDS, clampAssetTtl } from './asset-url'
import { settings } from '@app/services/GlobalSettingsService'

/**
 * Organization/project/session-scoped object key for a stored artifact.
 *
 * @param scope
 * @param leaf
 * @returns
 */
export function sessionObjectKey(
  scope: { organizationId: string; projectId: string; id: string },
  leaf: string,
): string {
  return `organizations/${scope.organizationId}/projects/${scope.projectId}/sessions/${scope.id}/${leaf}`
}

/**
 * Read stored bytes for an object, tolerating a missing key/object.
 *
 * @param key
 * @returns
 */
export async function readObject(key: string | null | undefined): Promise<Uint8Array> {
  if (!key) return new Uint8Array(0)
  try {
    return await Storage.disk().getBytes(key)
  } catch {
    return new Uint8Array(0)
  }
}

/**
 * A URL a client can load for a stored object. Remote disks (S3, R2, GCS) keep
 * objects private, so they get a time-limited signed URL using the platform asset
 * TTL; the local disk serves its public symlinks, so it gets the plain URL. A
 * signed URL expires, so call this when building a response and never persist
 * the result: store the object key instead.
 *
 * @param key
 * @returns
 */
export async function resolveObjectUrl(key: string): Promise<string> {
  const disk = Storage.disk()

  if (disk.getDriverName() === 'local') return await disk.getUrl(key)

  const ttl = await settings
    .current()
    .then((current) => clampAssetTtl(current.assets.url_ttl_seconds))
    .catch(() => DEFAULT_ASSET_TTL_SECONDS)

  try {
    return await disk.getSignedUrl(key, { expiresIn: `${ttl}s` })
  } catch {
    return await disk.getUrl(key)
  }
}

/**
 * Project branding as clients see it: an uploaded logo (`logo_key`) is resolved
 * to a loadable `logo_url`, and the internal key is never exposed.
 *
 * @param branding
 * @returns
 */
export async function resolveBranding(branding: ProjectBranding | null | undefined): Promise<ProjectBranding> {
  const { logo_key: logoKey, ...rest } = branding ?? {}

  if (!logoKey) return rest

  return { ...rest, logo_url: await resolveObjectUrl(logoKey) }
}
