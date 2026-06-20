import { ResourceCollection } from 'resora'
import PermissionResource from './PermissionResource'

export default class PermissionCollection extends ResourceCollection {
    collects = PermissionResource

    data () {
        return this.toObject()
    }
}
