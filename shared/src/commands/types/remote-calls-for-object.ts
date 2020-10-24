import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';
import { RemoteCallsForObject } from './remote-calls-for-objects';

@serializable
export class RemoteCallsForObjects extends Command {
  constructor(public readonly callsForObjects: Array<RemoteCallsForObject>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.callsForObjects];
  }
}
