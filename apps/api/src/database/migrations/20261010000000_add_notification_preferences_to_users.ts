import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Per-user notification preferences (e.g. `{ push: false }`). Null means defaults.
 */
export default class AddNotificationPreferencesToUsersMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('users', (table) => {
      table.json('notificationPreferences').nullable().map('notification_preferences')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('users', (table) => {
      table.dropColumn('notification_preferences')
    })
  }
}
