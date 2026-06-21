import { ResourceCollection } from 'resora'
import AuditLogResource from './AuditLogResource'

export default class AuditLogCollection extends ResourceCollection {
  collects = AuditLogResource

  data() {
    return this.toObject()
  }
}
