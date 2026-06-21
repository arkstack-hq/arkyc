import { Migration, SchemaBuilder } from 'arkormx'

export default class AddEmailVerifiedAtToUsersMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('users', (table) => {
      table.timestamp('emailVerifiedAt').nullable().map('email_verified_at')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('users', (table) => {
      table.dropColumn('email_verified_at')
    })
  }
}
