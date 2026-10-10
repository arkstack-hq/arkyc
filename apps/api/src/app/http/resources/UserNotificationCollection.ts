import { ResourceCollection } from 'resora'
import UserNotificationResource from './UserNotificationResource'

export default class UserNotificationCollection extends ResourceCollection {
  collects = UserNotificationResource

  data() {
    return this.toObject()
  }
}
