import { GameObject } from '../../objects/game-object';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class CreateObjectsCommand extends Command {
  public constructor(public readonly objects: Array<GameObject>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.objects];
  }
}
