import { ResourceCollection } from 'resora'
import AiAccessGrantResource from './AiAccessGrantResource'

export default class AiAccessGrantCollection extends ResourceCollection {
  collects = AiAccessGrantResource

  data() {
    return this.toObject()
  }
}
