import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateTenantsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('tenants', (table) => {
      table.id('id', 'uuid').primary()
      table.string('name')
      table.string('slug').unique().index()
      table.string('logoUrl').nullable().map('logo_url')
      table.json('settings').nullable()
      table.timestamps('camel', 'snake')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('tenants')
  }
}
