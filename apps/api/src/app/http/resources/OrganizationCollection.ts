import { ResourceCollection } from 'resora'
import OrganizationResource from './OrganizationResource'

export default class OrganizationCollection extends ResourceCollection {
  collects = OrganizationResource

  data() {
    return this.toObject()
  }
}
