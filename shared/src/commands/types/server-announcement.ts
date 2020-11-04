import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class ServerAnnouncement extends Command {
  constructor(public readonly text: string) {
    super();
  }

  public toArray(): Array<any> {
    return [this.text];
  }
}
