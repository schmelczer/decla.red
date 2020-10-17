import { Id } from '../main';
import { serializable } from '../transport/serialization/serializable';
import { UpdateMessage } from './update-message';

@serializable
export class UpdateObjectMessage {
  constructor(public id: Id, public updates: Array<UpdateMessage>) {}

  public toArray(): Array<any> {
    return [this.id, this.updates];
  }
}
