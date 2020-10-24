import { Id } from '../../main';
import { RemoteCall } from '../../objects/game-object';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class RemoteCallsForObject extends Command {
  constructor(public readonly id: Id, public readonly calls: Array<RemoteCall>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.id, this.calls];
  }
}
