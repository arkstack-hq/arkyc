import { Migration, SchemaBuilder } from 'arkormx'

export default class CreatePermissionsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('permissions', (table) => {
      table.id('id', 'uuid').primary()
      table.string('name').unique().index()
      table.string('description').nullable()
      table.string('group').index()
      table.timestamps('camel', 'snake')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('permissions')
  }
}
