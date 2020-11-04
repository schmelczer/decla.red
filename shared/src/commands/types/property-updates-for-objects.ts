import { PropertyUpdatesForObject } from '../../objects/game-object';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class PropertyUpdatesForObjects extends Command {
  constructor(public readonly updates: Array<PropertyUpdatesForObject>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.updates];
  }
}
