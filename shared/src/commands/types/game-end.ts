import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class GameEndCommand extends Command {
  public toArray(): Array<any> {
    return [];
  }
}
