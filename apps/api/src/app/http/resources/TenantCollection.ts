import { ResourceCollection } from 'resora'
import TenantResource from './TenantResource'

export default class TenantCollection extends ResourceCollection {
    collects = TenantResource

    data () {
        return this.toObject()
    }
}
