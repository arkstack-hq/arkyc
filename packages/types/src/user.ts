import type { Entity, IsoDateTime } from './common';

/** A platform user account. Users belong to one or more tenants via membership. */
export interface User extends Entity {
  name: string;
  email: string;
  /** Never serialised to clients; present on the DB row only. */
  password_hash?: string;
  avatar_url: string | null;
  last_login_at: IsoDateTime | null;
}

/** A user shape safe to expose to clients (no credential material). */
export type PublicUser = Omit<User, 'password_hash'>;
