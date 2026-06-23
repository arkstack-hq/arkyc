import { ResourceCollection } from 'resora'
import WorkflowResource from './WorkflowResource'

export default class WorkflowCollection extends ResourceCollection {
  collects = WorkflowResource

  data() {
    return this.toObject()
  }
}
