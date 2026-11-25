import WebhookDeliveryResource from './WebhookDeliveryResource'

/** A webhook delivery with the payload that was sent. */
export default class WebhookDeliveryDetailResource extends WebhookDeliveryResource {
  override data() {
    return {
      ...super.data(),
      payload: this.payload,
    }
  }
}
