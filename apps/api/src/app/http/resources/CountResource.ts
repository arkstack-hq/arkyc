import { Resource } from 'resora'

/** A bare `{ count }` payload (badge counters, totals). */
export default class CountResource extends Resource {
  data() {
    return { count: this.count }
  }
}
