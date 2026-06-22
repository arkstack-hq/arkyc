import { ResourceCollection } from 'resora'
import AdminAuditLogResource from './AdminAuditLogResource'

export default class AdminAuditLogCollection extends ResourceCollection {
  collects = AdminAuditLogResource

  data() {
    return this.toObject()
  }
}
