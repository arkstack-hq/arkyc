import { Resource } from 'resora'

/** A resource carrying no body — for actions that only need a status + message. */
export default class EmptyResource extends Resource {
    data () {
        return {}
    }
}
