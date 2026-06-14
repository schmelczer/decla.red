import { vec2 } from 'gl-matrix';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

// Sent server -> owning client only, alongside that client's own character
// snapshot. Carries the clientTimeMs of the most recent movement input the
// server had received when the snapshot was taken (so the client's predictor
// can reset to the snapshot and replay just the inputs the server hasn't seen
// yet) and the authoritative launch momentum (so the predictor reproduces a
// leap/slingshot/recoil flight rather than only snapping to it). See
// LocalCharacterPredictor.
@serializable
export class InputAcknowledgement extends Command {
  public constructor(
    public readonly clientTimeMs: number,
    public readonly bodyVelocity: vec2,
    // clientTimeMs of the most recent leap the server has received: any leap at
    // or before it is already reflected in bodyVelocity, so the predictor must
    // not replay it.
    public readonly lastLeapClientTimeMs: number,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs, this.bodyVelocity, this.lastLeapClientTimeMs];
  }
}
