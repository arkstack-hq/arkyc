import { ResourceCollection } from 'resora'
import VerificationSessionResource from './VerificationSessionResource'

export default class SessionCollection extends ResourceCollection {
  collects = VerificationSessionResource

  data () {
    return this.toObject()
  }
}
