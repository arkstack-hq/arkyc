import { Storage } from '@arkstack/filesystem'

/** Organization/project/session-scoped object key for a stored artifact. */
export function sessionObjectKey(scope: { organizationId: string; projectId: string; id: string }, leaf: string): string {
  return `organizations/${scope.organizationId}/projects/${scope.projectId}/sessions/${scope.id}/${leaf}`
}

/** Read stored bytes for an object, tolerating a missing key/object. */
export async function readObject(key: string | null | undefined): Promise<Uint8Array> {
  if (!key) return new Uint8Array(0)
  try {
    return await Storage.disk().getBytes(key)
  } catch {
    return new Uint8Array(0)
  }
}
