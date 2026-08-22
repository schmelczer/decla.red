import { vec2 } from 'gl-matrix';
import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class PrimaryActionCommand extends Command {
  public constructor(
    public readonly position: vec2,
    public readonly charge: number = 0,
    // Client wall-clock at shot release. Appended last so the existing wire
    // order is unchanged. The server fast-forwards the projectile by its
    // in-flight time so the shooter need not lead by their own latency.
    public readonly clientTimeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.position, this.charge, this.clientTimeMs];
  }
}
