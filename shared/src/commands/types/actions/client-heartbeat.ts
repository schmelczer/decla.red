import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

// Appended to every client -> server batch. Movement is only sent on change,
// so without this the server's "newest input applied" marker freezes while a
// key is held, pinning the predictor's replay window. This carries the client's
// wall-clock so the marker advances at the send rate regardless of input change.
@serializable
export class ClientHeartbeatCommand extends Command {
  public constructor(public readonly clientTimeMs: number = 0) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs];
  }
}
