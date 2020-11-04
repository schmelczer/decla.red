import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class GameStartCommand extends Command {
  constructor() {
    super();
  }

  public toArray(): Array<any> {
    return [];
  }
}
