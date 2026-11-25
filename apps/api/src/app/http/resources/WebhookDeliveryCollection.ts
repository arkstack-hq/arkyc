import { ResourceCollection } from 'resora'
import WebhookDeliveryResource from './WebhookDeliveryResource'

export default class WebhookDeliveryCollection extends ResourceCollection {
  collects = WebhookDeliveryResource

  data() {
    return this.toObject()
  }
}
