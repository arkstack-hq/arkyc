import { ResourceCollection } from 'resora'
import ProjectMemberResource from './ProjectMemberResource'

export default class ProjectMemberCollection extends ResourceCollection {
  collects = ProjectMemberResource

  data() {
    return this.toObject()
  }
}
