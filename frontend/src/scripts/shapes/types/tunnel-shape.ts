import { vec2 } from 'gl-matrix';
import { InvertedTunnel } from 'sdf-2d';
import { clamp01 } from '../../helper/clamp';
import { rotate90Deg } from '../../helper/rotate-90-deg';
import { GameObject } from '../../objects/game-object';
import { BoundingBox } from '../bounding-box';
import { IShape } from '../i-shape';

export class TunnelShape extends InvertedTunnel implements IShape {
  constructor(
    readonly from: vec2,
    readonly to: vec2,
    readonly fromRadius: number,
    readonly toRadius: number,
    public readonly gameObject: GameObject = null
  ) {
    super(from, to, fromRadius, toRadius);
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

    const toFromDelta = vec2.subtract(vec2.create(), this.to, this.from);

    const h = clamp01(
      vec2.dot(targetFromDelta, toFromDelta) / vec2.dot(toFromDelta, toFromDelta)
    );

    let diff = vec2.create();

    if (h == 1) {
      vec2.subtract(diff, target, this.to);
    } else if (h == 0) {
      vec2.subtract(diff, target, this.from);
    } else {
      const side = Math.sign(
        toFromDelta.x * targetFromDelta.y - toFromDelta.y * targetFromDelta.x
      );

      const normal = rotate90Deg(toFromDelta);
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
