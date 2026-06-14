import { PropertyUpdatesForObject } from '../../objects/game-object';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class PropertyUpdatesForObjects extends Command {
  constructor(
    public readonly updates: Array<PropertyUpdatesForObject>,
    // Seconds on the server's monotonic clock at the moment this state was
    // captured. Only differences between timestamps are meaningful.
    public readonly timestamp: number,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.updates, this.timestamp];
  }
}
