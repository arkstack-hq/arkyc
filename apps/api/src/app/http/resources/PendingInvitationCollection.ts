import { ResourceCollection } from 'resora'
import PendingInvitationResource from './PendingInvitationResource'

export default class PendingInvitationCollection extends ResourceCollection {
  collects = PendingInvitationResource

  data() {
    return this.toObject()
  }
}
