import { Seeder } from '@arkstack/database'
import { PermissionSeeder } from './PermissionSeeder'
import { DemoTenantSeeder } from './DemoTenantSeeder'

export class DatabaseSeeder extends Seeder {
    public async run (): Promise<void> {
        this.call([
            // Global permission catalogue first; the demo tenant grants from it.
            PermissionSeeder,
            DemoTenantSeeder,
        ])
    }
}
