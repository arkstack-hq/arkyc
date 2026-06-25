import { Resource } from 'resora'

/** The secret-safe runtime-config snapshot, served on the `/admin` surface. */
export default class EnvironmentResource extends Resource {
  data() {
    return {
      generated_at: this.generated_at,
      node_env: this.node_env,
      version: this.version,
      sections: this.sections,
    }
  }
}
