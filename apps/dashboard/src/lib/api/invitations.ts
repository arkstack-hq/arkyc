import { CACHE, type Paginated, alova, params } from './client'

/** An organization invitation addressed to the signed-in user. */
export interface PendingInvitation {
  id: string
  organization: { id: string; name: string; slug: string } | null
  role: { id: string; name: string } | null
  expires_at: string
  created_at: string
}

/** Invitations the signed-in user can accept without the link token. */
export class Invitations {
  /** Pending invitations for the user's verified email. */
  static pending(query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<PendingInvitation>>('/v1/account/invitations', {
      name: 'invitations:pending',
      cacheFor: CACHE,
      hitSource: ['invitation:accept'],
      params: params(query as Record<string, unknown>),
    })
  }

  /** Accept one pending invitation. */
  static accept(id: string) {
    return alova.Patch<unknown>(`/v1/account/invitations/${id}/accept`, {}, { name: 'invitation:accept' })
  }
}
