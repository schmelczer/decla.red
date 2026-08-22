import { vec2 } from 'gl-matrix';
import { Id } from '../../communication/communication';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

/**
 * Movement state carried tick-to-tick that is NOT in the pose. Together with
 * the pose (which travels as ordinary property updates) this is the complete
 * state `stepCharacterMovement` needs, so the predictor resumes the server's
 * simulation rather than approximating it.
 *
 * `direction` is not recoverable from the pose: the body is sprung *towards*
 * the posture that direction implies and lags it while walking, so deriving the
 * angle back out is off by tens of degrees.
 */
@serializable
export class CharacterMovementSnapshot {
  public constructor(
    public readonly direction: number,
    public readonly bodyVelocity: vec2,
    public readonly leftFootNormal: vec2,
    public readonly rightFootNormal: vec2,
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

// Sent server -> owning client only. Carries the clientTimeMs of the most
// recent input the server had received when the snapshot was taken (so the
// predictor replays only the inputs the server hasn't seen) and the movement
// state the replay resumes from. See LocalCharacterPredictor.
@serializable
export class InputAcknowledgement extends Command {
  public constructor(
    public readonly clientTimeMs: number,
    public readonly movement: CharacterMovementSnapshot,
    // clientTimeMs of the most recent leap the server has received: any leap at
    // or before it is already in movement.bodyVelocity and must not be replayed.
    public readonly lastLeapClientTimeMs: number,
    // Age of the acknowledged input at snapshot time. Adding it back places the
    // replay anchor at the snapshot instant instead of whichever input landed
    // last, keeping the predicted pose free of the send-cadence beat.
    public readonly ackAgeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs, this.movement, this.lastLeapClientTimeMs, this.ackAgeMs];
  }
}
