import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

// Appended to every client -> server batch. Movement is only transmitted when it
// changes, so on its own the server's "newest input I have applied" marker
// freezes whenever a key is simply held down — which pins the client predictor's
// replay window and stops reconciliation from covering the un-acknowledged
// input. This carries the client's wall-clock for the batch, so the marker keeps
// advancing at the send rate whether or not the input changed.
@serializable
export class ClientHeartbeatCommand extends Command {
  public constructor(public readonly clientTimeMs: number = 0) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs];
  }
}
