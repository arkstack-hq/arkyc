/**
 * Shared primitive aliases used across Arkyc domain types.
 *
 * These are intentionally light: they document intent at call sites without
 * adding runtime weight. IDs are strings (prefixed identifiers like
 * `kyc_sess_…`, `tenant_…`, `project_…`); timestamps are ISO-8601 strings.
 */

/** A unique identifier (typically a prefixed, URL-safe string). */
export type Id = string

/** An ISO-8601 date-time string, e.g. `2026-06-20T00:00:00.000Z`. */
export type IsoDateTime = string

/** An ISO-8601 date string (no time component), e.g. `1990-05-21`. */
export type IsoDate = string

/** Arbitrary, JSON-serialisable metadata attached to an entity. */
export type Metadata = Record<string, unknown>

/** Columns shared by every persisted entity. */
export interface Timestamps {
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/** A persisted entity: an `id` plus creation/update timestamps. */
export interface Entity extends Timestamps {
  id: Id
}

/** Scoping columns present on every tenant-owned entity. */
export interface TenantScoped {
  tenant_id: Id
}

/** Scoping columns present on every project-owned entity. */
export interface ProjectScoped extends TenantScoped {
  project_id: Id
}
