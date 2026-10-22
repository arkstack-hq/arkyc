import { ResourceCollection } from 'resora'
import BusinessVerificationResource from './BusinessVerificationResource'

export default class BusinessVerificationCollection extends ResourceCollection {
  collects = BusinessVerificationResource

  data() {
    return this.toObject()
  }
}
