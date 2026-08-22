import { vec2 } from 'gl-matrix';
import { Id } from '../../communication/id';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

/**
 * Everything the character's movement simulation carries from one tick to the
 * next that is *not* in the pose.
 *
 * The pose (head/feet circles) travels as ordinary property updates because
 * every viewer needs it; this travels to the owning client only. Together they
 * are the complete state `stepCharacterMovement` needs, so the predictor can
 * resume the server's simulation rather than approximate it.
 *
 * It all has to be here. `direction` in particular is not recoverable from the
 * pose: the body is sprung *towards* the posture that direction implies and
 * lags it while walking, so deriving the angle back out of a walking pose is
 * off by tens of degrees — and every replay then spent its first ticks
 * twisting the body back, by an amount that varied with the replay length.
 */
@serializable
export class CharacterMovementSnapshot {
  public constructor(
    public readonly direction: number,
    // Persistent launch momentum (leap / slingshot / recoil), so the predictor
    // reproduces a flight rather than only snapping to it.
    public readonly bodyVelocity: vec2,
    // Foot contact normals: the on-surface branch projects gravity onto these,
    // so a body standing on a slope needs the real ones.
    public readonly leftFootNormal: vec2,
    public readonly rightFootNormal: vec2,
    // The planet being stood on, or null while airborne.
    public readonly groundPlanetId: Id,
    public readonly secondsSinceOnSurface: number,
  ) {}

  public toArray(): Array<any> {
    return [
      this.direction,
      this.bodyVelocity,
      this.leftFootNormal,
      this.rightFootNormal,
      this.groundPlanetId,
      this.secondsSinceOnSurface,
    ];
  }
}

// Sent server -> owning client only, alongside that client's own character
// snapshot. Carries the clientTimeMs of the most recent input the server had
// received when the snapshot was taken (so the client's predictor can reset to
// the snapshot and replay just the inputs the server hasn't seen yet) and the
// authoritative movement state the replay resumes from. See
// LocalCharacterPredictor.
@serializable
export class InputAcknowledgement extends Command {
  public constructor(
    public readonly clientTimeMs: number,
    public readonly movement: CharacterMovementSnapshot,
    // clientTimeMs of the most recent leap the server has received: any leap at
    // or before it is already reflected in movement.bodyVelocity, so the
    // predictor must not replay it.
    public readonly lastLeapClientTimeMs: number,
    // How long before this snapshot the acknowledged input arrived. The client
    // sends at a fixed cadence, so by the time a snapshot is taken the newest
    // input it has is already 0..1 send interval old — and that age varies with
    // where the client's sends happened to fall between two snapshots. Adding
    // it back places the replay anchor at the snapshot instant itself instead
    // of at whichever input happened to land last, which is what keeps the
    // predicted pose free of the send-cadence beat. See LocalCharacterPredictor.
    public readonly ackAgeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs, this.movement, this.lastLeapClientTimeMs, this.ackAgeMs];
  }
}
