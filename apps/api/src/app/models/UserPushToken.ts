import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { PushPlatform } from '@arkyc/types'
import { PersonalAccessToken } from './PersonalAccessToken'
import { User } from './User'

/** A device push registration, tied to the login session that registered it. */
export class UserPushToken extends Model {
  protected static override table = 'user_push_tokens'

  declare id: string
  declare userId: string
  declare personalAccessTokenId: string
  declare token: string
  declare platform: PushPlatform
  declare deviceName: string | null
  declare isActive: boolean
  declare lastRegisteredAt: Date
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    userId: 'user_id',
    personalAccessTokenId: 'personal_access_token_id',
    deviceName: 'device_name',
    isActive: 'is_active',
    lastRegisteredAt: 'last_registered_at',
  }

  protected override casts: CastMap = {
    isActive: 'boolean',
  }

  user() {
    return this.belongsTo(User, 'userId', 'id')
  }

  personalAccessToken() {
    return this.belongsTo(PersonalAccessToken, 'personalAccessTokenId', 'id')
  }
}
