import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Store when a notification was read as a timestamp, and index unread lookups.
 */
export default class ChangeUserNotificationsReadAtMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('user_notifications', (table) => {
      table.timestamp('readAt').nullable().map('read_at').change()
      table.index(['user_id', 'read_at'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('user_notifications', (table) => {
      table.date('readAt').nullable().map('read_at').change()
    })
  }
}
