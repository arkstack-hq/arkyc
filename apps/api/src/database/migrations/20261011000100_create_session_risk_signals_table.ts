import { Migration, SchemaBuilder } from 'arkormx'

/** Fraud and compliance signals raised against a verification session. */
export default class CreateSessionRiskSignalsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('session_risk_signals', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
      table.uuid('projectId').map('project_id').foreign().references('projects', 'id').onDelete('cascade')
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
      table.string('key')
      table.enum('severity', ['info', 'review', 'reject'])
      table.float('score')
      table.boolean('advisory').default(false)
      table.string('source')
      table.json('evidence').nullable()
      table.timestamp('clearedAt').nullable().map('cleared_at')
      table.uuid('clearedBy').nullable().map('cleared_by')
      table.text('clearReason').nullable().map('clear_reason')
      table.timestamps('camel', 'snake')
      table.index(['sessionId'])
      table.index(['organizationId', 'key'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('session_risk_signals')
  }
}
