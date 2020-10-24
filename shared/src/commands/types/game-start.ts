import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class GameStart extends Command {
  constructor() {
    super();
  }

  public toArray(): Array<any> {
    return [];
  }
}
