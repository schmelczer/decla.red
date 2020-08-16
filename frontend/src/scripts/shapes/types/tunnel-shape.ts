import { vec2 } from 'gl-matrix';
import { BoundingBox } from '../bounding-box';
import { clamp01 } from '../../helper/clamp';
import { mix } from '../../helper/mix';
import { IShape } from '../i-shape';

export class TunnelShape implements IShape {
  public readonly isInverted = true;

  public readonly toFromDelta: vec2;

  constructor(
    public readonly from: vec2,
    public readonly to: vec2,
    public readonly fromRadius: number,
    public readonly toRadius: number
  ) {
    this.toFromDelta = vec2.subtract(vec2.create(), to, from);
  }

  public get boundingBox(): BoundingBox {
    const xMin = Math.min(
      this.from.x - this.fromRadius,
      this.to.x - this.toRadius
    );
    const yMin = Math.min(
      this.from.y - this.fromRadius,
      this.to.y - this.toRadius
    );
    const xMax = Math.max(
      this.from.x + this.fromRadius,
      this.to.x + this.toRadius
    );
    const yMax = Math.max(
      this.from.y + this.fromRadius,
      this.to.y + this.toRadius
    );

    return new BoundingBox(this, xMin, xMax, yMin, yMax);
  }

  public normal(from: vec2): vec2 {
    throw new Error('Unimplemented');
  }

  public distance(target: vec2): number {
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);

    const h = clamp01(
      vec2.dot(targetFromDelta, this.toFromDelta) /
        vec2.dot(this.toFromDelta, this.toFromDelta)
    );

    return (
      vec2.distance(
        targetFromDelta,
        vec2.scale(vec2.create(), this.toFromDelta, h)
      ) - mix(this.fromRadius, this.toRadius, h)
    );
  }

  public clone(): TunnelShape {
    return new TunnelShape(this.from, this.to, this.fromRadius, this.toRadius);
  }
}
