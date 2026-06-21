import { ResourceCollection } from 'resora'
import WebhookEndpointResource from './WebhookEndpointResource'

export default class WebhookEndpointCollection extends ResourceCollection {
  collects = WebhookEndpointResource

  data() {
    return this.toObject()
  }
}
