import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

// "The round is over" — a bare signal, like GameStartCommand. The winner is
// announced through ServerAnnouncement and the end-card length is the server's
// own restart timer, so neither has to travel here.
@serializable
export class GameEndCommand extends Command {
  public toArray(): Array<any> {
    return [];
  }
}
