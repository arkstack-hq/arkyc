import { ResourceCollection } from 'resora'
import AdminProjectResource from './AdminProjectResource'

export default class AdminProjectCollection extends ResourceCollection {
  collects = AdminProjectResource

  data() {
    return this.toObject()
  }
}
