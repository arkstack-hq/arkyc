import { ResourceCollection } from 'resora'
import ApiKeyResource from './ApiKeyResource'

export default class ApiKeyCollection extends ResourceCollection {
    collects = ApiKeyResource

    data () {
        return this.toObject()
    }
}
