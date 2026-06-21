import { Seeder } from '@arkstack/database'
import { Permission } from 'src/app/models/Permission'
import { Catalogue } from '@arkyc/permissions'

/** Upsert the global permission catalogue. Idempotent. */
export class PermissionSeeder extends Seeder {
    public async run (): Promise<void> {
        for (const def of Catalogue.ALL) {
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
