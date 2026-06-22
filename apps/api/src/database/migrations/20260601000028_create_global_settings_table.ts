import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Platform-wide settings store (Phase 15) — a single JSON row managed through
 * the `GlobalSettingsService` singleton and read by the app at runtime.
 */
export default class CreateGlobalSettingsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('global_settings', (table) => {
      table.id('id', 'uuid').primary()
      table.json('settings')
      table.timestamps('camel', 'snake')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('global_settings')
  }
}
