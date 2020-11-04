import { Id, RemoteCall } from '../../main';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class RemoteCallsForObject {
  constructor(public readonly id: Id, public readonly calls: Array<RemoteCall>) {}

  public toArray(): Array<any> {
    return [this.id, this.calls];
  }
}

@serializable
export class RemoteCallsForObjects extends Command {
  constructor(public readonly callsForObjects: Array<RemoteCallsForObject>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.callsForObjects];
  }
}
