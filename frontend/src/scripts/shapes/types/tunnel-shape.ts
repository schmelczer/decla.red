import { vec2 } from 'gl-matrix';
import { InvertedTunnel } from 'sdf-2d';

export class TunnelShape extends InvertedTunnel {
  constructor(from: vec2, to: vec2, fromRadius: number, toRadius: number) {
    super(from, to, fromRadius, toRadius);
  }

  public clone(): TunnelShape {
    return new TunnelShape(
      vec2.clone(this.from),
      vec2.clone(this.to),
      this.fromRadius,
      this.toRadius
    );
  }
}
