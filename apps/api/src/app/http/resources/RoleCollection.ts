import { ResourceCollection } from 'resora'
import RoleResource from './RoleResource'

export default class RoleCollection extends ResourceCollection {
  collects = RoleResource

  data() {
    return this.toObject()
  }
}
