import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Hot-path indexes on verification_sessions (Phase 20 perf review):
 * - `expires_at` backs the recurring expiry sweep (non-terminal + past-TTL scan).
 * - `(organization_id, status)` backs the dashboard review queue (org-scoped
 *   status filter); only `(project_id, status)` + `organization_id` existed.
 * alterTable indexes take the real column names, not model attributes.
 */
export default class AddSessionHotPathIndexesMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.index(['expires_at'])
      table.index(['organization_id', 'status'])
    })
  }

  public async down(_schema: SchemaBuilder): Promise<void> {
    // No-op: these indexes are purely additive (query performance), so leaving
    // them in place on rollback is harmless, and the builder has no dropIndex.
  }
}
