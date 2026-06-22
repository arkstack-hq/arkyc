import { ResourceCollection } from 'resora'
import AdminUserResource from './AdminUserResource'

export default class AdminUserCollection extends ResourceCollection {
  collects = AdminUserResource

  data() {
    return this.toObject()
  }
}
