import { ResourceCollection } from 'resora'
import AccessGrantResource from './AccessGrantResource'

export default class AccessGrantCollection extends ResourceCollection {
  collects = AccessGrantResource

  data() {
    return this.toObject()
  }
}
