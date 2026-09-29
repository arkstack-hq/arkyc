import { Model } from 'arkormx'
import { PersonalAccessToken } from './PersonalAccessToken'
import { User } from './User'
export class UserPushToken extends Model {
  declare id: string
  declare userId: string
  declare personalAccessTokenId: string
  declare token: string
  declare platform: 'ios' | 'android' | 'web'
  declare deviceName: string | null
  declare isActive: boolean
  declare lastRegisteredAt: Date
  declare createdAt: Date
  declare updatedAt: Date

  user() {
    return this.belongsTo(User, 'userId', 'id')
  }

  personalAccessToken() {
    return this.belongsTo(PersonalAccessToken, 'personalAccessTokenId', 'id')
  }
}
