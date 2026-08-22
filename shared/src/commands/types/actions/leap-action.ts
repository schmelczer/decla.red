import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

// clientTimeMs is echoed back via InputAcknowledgement so the predictor knows
// which leaps the server has already folded into the streamed launch momentum
// and must not replay again.
@serializable
export class LeapActionCommand extends Command {
  public constructor(public readonly clientTimeMs: number = 0) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs];
  }
}
