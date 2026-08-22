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
    // How long before this snapshot the acknowledged input arrived. The client
    // sends at its frame rate, so by the time a snapshot is taken the newest
    // input it has is already 0..1 frame old — and that age varies with where
    // the client's frames happened to fall between two snapshots. Adding it
    // back places the replay anchor at the snapshot instant itself instead of
    // at whichever input happened to land last, which is what keeps the
    // predicted pose free of the send-cadence beat. See LocalCharacterPredictor.
    public readonly ackAgeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [
      this.clientTimeMs,
      this.bodyVelocity,
      this.lastLeapClientTimeMs,
      this.ackAgeMs,
    ];
  }
}
