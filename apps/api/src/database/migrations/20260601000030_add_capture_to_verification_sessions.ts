import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Active-liveness capture (Phase 17): the capture model resolved for the session
 * (project override > global setting), and the randomized challenge sequence the
 * server issued (validated when the liveness video is submitted).
 */
export default class AddCaptureToVerificationSessionsMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.string('captureModel').nullable().map('capture_model')
      table.json('livenessChallenges').nullable().map('liveness_challenges')
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('verification_sessions', (table) => {
      table.dropColumn('capture_model')
      table.dropColumn('liveness_challenges')
    })
  }
}
