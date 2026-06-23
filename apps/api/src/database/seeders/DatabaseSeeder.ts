import { Seeder } from '@arkstack/database'
import { PermissionSeeder } from './PermissionSeeder'
import { DemoOrganizationSeeder } from './DemoOrganizationSeeder'

export class DatabaseSeeder extends Seeder {
  public async run(): Promise<void> {
    this.call([
      // Global permission catalogue first; the demo organization grants from it.
      PermissionSeeder,
      DemoOrganizationSeeder,
    ])
  }
}
