import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateUserPushTokensTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
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

      table
        .foreign('personalAccessTokenId')
        .references('personal_access_tokens', 'id')
        .onDelete('cascade')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('user_push_tokens')
  }
}
