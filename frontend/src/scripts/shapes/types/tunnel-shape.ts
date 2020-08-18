import { vec2 } from 'gl-matrix';
import { BoundingBox } from '../bounding-box';
import { clamp01 } from '../../helper/clamp';
import { mix } from '../../helper/mix';
import { IShape } from '../i-shape';
import { rotate90Deg } from '../../helper/rotate-90-deg';
import { GameObject } from '../../objects/game-object';

export default class TunnelShape implements IShape {
  public readonly isInverted = true;

  public readonly toFromDelta: vec2;

  constructor(
    public readonly from: vec2,
    public readonly to: vec2,
    public readonly fromRadius: number,
    public readonly toRadius: number,
    public readonly gameObject: GameObject = null
  ) {
    this.toFromDelta = vec2.subtract(vec2.create(), to, from);
  }

  public get boundingBox(): BoundingBox {
    const xMin = Math.min(this.from.x - this.fromRadius, this.to.x - this.toRadius);
    const yMin = Math.min(this.from.y - this.fromRadius, this.to.y - this.toRadius);
    const xMax = Math.max(this.from.x + this.fromRadius, this.to.x + this.toRadius);
    const yMax = Math.max(this.from.y + this.fromRadius, this.to.y + this.toRadius);

    return new BoundingBox(this, xMin, xMax, yMin, yMax);
  }

  public normal(target: vec2): vec2 {
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);

    const h = clamp01(
      vec2.dot(targetFromDelta, this.toFromDelta) /
        vec2.dot(this.toFromDelta, this.toFromDelta)
    );

    let diff = vec2.create();

    if (h == 1) {
      vec2.subtract(diff, target, this.to);
    } else if (h == 0) {
      vec2.subtract(diff, target, this.from);
    } else {
      const side = Math.sign(
        this.toFromDelta.x * targetFromDelta.y - this.toFromDelta.y * targetFromDelta.x
      );

      const normal = rotate90Deg(this.toFromDelta);
      vec2.normalize(normal, normal);

      const translatedFrom = vec2.add(
        vec2.create(),
        this.from,
        vec2.scale(vec2.create(), normal, side * this.fromRadius)
      );

      const translatedTo = vec2.add(
        vec2.create(),
        this.to,
        vec2.scale(vec2.create(), normal, side * this.toRadius)
      );

      diff = rotate90Deg(vec2.subtract(vec2.create(), translatedTo, translatedFrom));

      vec2.scale(diff, diff, side);
    }

    return vec2.normalize(diff, diff);
  }

  public distance(target: vec2): number {
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);

    const h = clamp01(
      vec2.dot(targetFromDelta, this.toFromDelta) /
        vec2.dot(this.toFromDelta, this.toFromDelta)
    );

    return (
      vec2.distance(targetFromDelta, vec2.scale(vec2.create(), this.toFromDelta, h)) -
      mix(this.fromRadius, this.toRadius, h)
    );
  }

  public clone(): TunnelShape {
    return new TunnelShape(
      vec2.clone(this.from),
      vec2.clone(this.to),
      this.fromRadius,
      this.toRadius,
      this.gameObject
    );
  }
}
