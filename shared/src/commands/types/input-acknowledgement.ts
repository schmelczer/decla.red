import { vec2 } from 'gl-matrix';
import { Id } from '../../communication/communication';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

// `direction` is not recoverable from the pose: the body lags the posture it is sprung towards.
@serializable
export class CharacterMovementSnapshot {
  public constructor(
    public readonly direction: number,
    public readonly bodyVelocity: vec2,
    public readonly leftFootNormal: vec2,
    public readonly rightFootNormal: vec2,
    public readonly groundPlanetId: Id | null,
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

@serializable
export class InputAcknowledgement extends Command {
  public constructor(
    public readonly clientTimeMs: number,
    public readonly movement: CharacterMovementSnapshot,
    public readonly lastLeapClientTimeMs: number,
    public readonly ackAgeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs, this.movement, this.lastLeapClientTimeMs, this.ackAgeMs];
  }
}
