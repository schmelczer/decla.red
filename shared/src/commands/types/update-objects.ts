import { vec2 } from 'gl-matrix';
import { UpdateObjectMessage } from '../../objects/update-object-message';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class UpdateObjectsCommand extends Command {
  public constructor(public readonly updates: Array<UpdateObjectMessage>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.updates];
  }
}
