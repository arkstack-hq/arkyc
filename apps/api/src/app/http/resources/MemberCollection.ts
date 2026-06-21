import { ResourceCollection } from 'resora'
import MemberResource from './MemberResource'

export default class MemberCollection extends ResourceCollection {
  collects = MemberResource

  data() {
    return this.toObject()
  }
}
