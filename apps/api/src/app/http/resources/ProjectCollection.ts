import { ResourceCollection } from 'resora'
import ProjectResource from './ProjectResource'

export default class ProjectCollection extends ResourceCollection {
  collects = ProjectResource

  data() {
    return this.toObject()
  }
}
