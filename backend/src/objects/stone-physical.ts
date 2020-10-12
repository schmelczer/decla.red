import { vec2 } from 'gl-matrix';
import { clamp01, id, serializesTo, StoneBase } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { StaticPhysical } from '../physics/containers/static-physical';

@serializesTo(StoneBase)
export class StonePhysical extends StoneBase implements StaticPhysical {
  public readonly canCollide = true;
  public readonly canMove = false;

  private _boundingBox?: ImmutableBoundingBox;

  constructor(vertices: Array<vec2>) {
    super(id(), vertices);
  }

  public distance(target: vec2): number {
    const startEnd = this.vertices[0];
    let vb = startEnd;

    let d = vec2.squaredDistance(target, vb);
    let sign = 1;

    for (let i = 1; i <= this.vertices.length; i++) {
      const va = vb;
      vb = i === this.vertices.length ? startEnd : this.vertices[i];
      const targetFromDelta = vec2.subtract(vec2.create(), target, va);
      const toFromDelta = vec2.subtract(vec2.create(), vb, va);
      const h = clamp01(
        vec2.dot(targetFromDelta, toFromDelta) / vec2.squaredLength(toFromDelta),
      );

      const ds = vec2.fromValues(
        vec2.dist(targetFromDelta, vec2.scale(vec2.create(), toFromDelta, h)),
        toFromDelta.x * targetFromDelta.y - toFromDelta.y * targetFromDelta.x,
      );

      if (
        (target.y >= va.y && target.y < vb.y && ds.y > 0) ||
        (target.y < va.y && target.y >= vb.y && ds.y <= 0)
      ) {
        sign *= -1;
      }

      d = Math.min(d, ds.x);
    }

    return sign * d;
  }

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      const { xMin, xMax, yMin, yMax } = this.vertices.reduce(
        (extremities, vertex) => ({
          xMin: Math.min(extremities.xMin, vertex.x),
          xMax: Math.max(extremities.xMax, vertex.x),
          yMin: Math.min(extremities.yMin, vertex.y),
          yMax: Math.max(extremities.yMax, vertex.y),
        }),
        {
          xMin: Infinity,
          xMax: -Infinity,
          yMin: Infinity,
          yMax: -Infinity,
        },
      );

      this._boundingBox = new ImmutableBoundingBox(xMin, xMax, yMin, yMax);
    }

    return this._boundingBox;
  }

  public get gameObject(): this {
    return this;
  }
}
