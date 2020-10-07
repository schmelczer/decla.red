import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class DeleteObjectsCommand extends Command {
  public constructor(public readonly ids: Array<Id>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.ids];
  }
}
