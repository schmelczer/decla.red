import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

// Sent client -> server when the player triggers a leap (Space / leap button).
// The launch direction is derived server-side from the character's surface
// normal and current movement input. clientTimeMs is the client's wall-clock at
// the press, echoed back via InputAcknowledgement so the predictor knows which
// leaps the server has already folded into the streamed launch momentum and
// must not replay again.
@serializable
export class LeapActionCommand extends Command {
  public constructor(public readonly clientTimeMs: number = 0) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs];
  }
}
