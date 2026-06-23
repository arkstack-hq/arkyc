import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateWorkflowsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('workflows', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('workflows')
      table.string('name')
      table.json('steps')
      table.json('options')
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
    })

    // Snapshot the applied workflow config onto each session so editing or
    // deleting a workflow never disturbs sessions already in flight. `workflowId`
    // is a plain reference (no FK) for traceability only.
    schema.alterTable('verification_sessions', (table) => {
      table.uuid('workflowId').nullable().map('workflow_id')
      table.json('workflow').nullable()
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.dropColumn('workflow')
      table.dropColumn('workflow_id')
    })
    schema.dropTable('workflows')
  }
}
