import { Migration, SchemaBuilder } from 'arkormx'

export default class AddStatusToUsersMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    // Account standing: `active` (default), `restricted` (read-only — mutations
    // are denied), or `suspended` (login blocked). Nullable; null is treated as
    // `active`, so existing rows need no backfill.
    schema.alterTable('users', (table) => {
      table.string('status').nullable()
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('users', (table) => {
      table.dropColumn('status')
    })
  }
}
