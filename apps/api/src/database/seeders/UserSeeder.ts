import { Seeder } from '@arkstack/database'
import { User } from 'src/app/models/User'

export class UserSeeder extends Seeder {
  public async run(): Promise<void> {
    if (await User.where({ email: 'admin@example.com' }).doesntExist()) {
      await User.factory(1).create({
        email: 'admin@example.com'
      })
    }

    await User.factory(5).create()
  }
}
