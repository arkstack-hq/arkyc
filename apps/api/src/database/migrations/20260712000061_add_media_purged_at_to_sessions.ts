import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Data-retention marker (Phase 20). `media_purged_at` records when a session's
 * captured media was deleted by the retention sweep, so the sweep can skip
 * already-purged rows. Nullable; existing rows are treated as not-yet-purged.
 * The `(organization_id, media_purged_at)` index backs the per-tenant sweep query.
 */
export default class AddMediaPurgedAtToSessionsMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.timestamp('mediaPurgedAt').nullable().map('media_purged_at')
      // alterTable indexes take the actual column names, not model attributes.
      table.index(['organization_id', 'media_purged_at'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.dropColumn('media_purged_at')
    })
  }
}
