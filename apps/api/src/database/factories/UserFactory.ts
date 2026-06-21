import { Hash } from '@arkstack/common'
import { ModelFactory } from '@arkstack/database'
import { User } from '@app/models/User'
import { fakerEN_NG as faker } from '@faker-js/faker'

export class UserFactory extends ModelFactory<User> {
  protected model = User

  protected async definition(_sequence: number) {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number({ style: 'international' }),
      password: await Hash.make('password'),
    }
  }
}
