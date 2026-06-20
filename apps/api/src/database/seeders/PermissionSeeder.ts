import { Seeder } from '@arkstack/database'
import { Permission } from 'src/app/models/Permission'
import { PERMISSION_CATALOGUE } from '@arkyc/permissions'

/** Upsert the global permission catalogue. Idempotent. */
export class PermissionSeeder extends Seeder {
    public async run (): Promise<void> {
        for (const def of PERMISSION_CATALOGUE) {
            const existing = await Permission.where({ name: def.name }).first()
            if (!existing) {
                await Permission.create({
                    name: def.name,
                    description: def.description,
                    group: def.group,
                })
            }
        }
    }
}
