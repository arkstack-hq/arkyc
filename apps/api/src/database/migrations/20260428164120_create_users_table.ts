import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateUsersTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('users', (table) => {
      table.id('id', 'uuid').primary()
      table.string('firstName').map('firstname')
      table.string('lastName').nullable().map('lastname')
      table.string('email').unique().index()
      table.string('phone').nullable().unique().index()
      table.string('password')
      table.timestamps('camel', 'snake')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('users')
  }
}
