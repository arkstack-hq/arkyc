import { DB, Migration, SchemaBuilder } from 'arkormx'

/**
 * Originally committed as `20260408201833_…`, which sorted before the `users` and
 * `personal_access_tokens` tables it references, so a fresh database (CI) failed
 * with `relation "users" does not exist`. Renamed to run after them. Databases
 * that already applied it under the old name have the table, so skip creating it
 * again there.
 */
export default class CreateUserPushTokensTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    const [existing] = (
      await DB.raw<{ name: string | null }>("select to_regclass('user_push_tokens')::text as name")
    ).all()

    if (existing?.name) return

    schema.createTable('user_push_tokens', (table) => {
      table.id('id', 'uuid').primary()
      table.uuid('userId').map('user_id').foreign().references('users', 'id').onDelete('cascade')
      table.uuid('personalAccessTokenId').map('personal_access_token_id').unique()
      table.string('token').unique()
      table.enum('platform', ['ios', 'android', 'web'])
      table.text('deviceName').map('device_name').nullable()
      table.boolean('isActive').map('is_active').default(true)
      table.timestamp('lastRegisteredAt').map('last_registered_at').default('now()')
      table.timestamps()

      table.foreign('personalAccessTokenId').references('personal_access_tokens', 'id').onDelete('cascade')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('user_push_tokens')
  }
}
