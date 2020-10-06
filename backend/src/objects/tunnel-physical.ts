import { vec2 } from 'gl-matrix';
import { clamp01, mix, TunnelBase, id, typeToBaseType } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { StaticPhysical } from '../physics/containers/static-physical-object';

@typeToBaseType
export class TunnelPhysical extends TunnelBase implements StaticPhysical {
  public readonly canCollide = true;
  public readonly isInverted = true;
  public readonly canMove = false;

  private _boundingBox?: ImmutableBoundingBox;

  constructor(from: vec2, to: vec2, fromRadius: number, toRadius: number) {
    super(id(), from, to, fromRadius, toRadius);
  }

  public distance(target: vec2): number {
    const toFromDelta = vec2.subtract(vec2.create(), this.to, this.from);
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);

    const h = clamp01(
      vec2.dot(targetFromDelta, toFromDelta) / vec2.dot(toFromDelta, toFromDelta)
    );

    return (
      vec2.distance(targetFromDelta, vec2.scale(vec2.create(), toFromDelta, h)) -
      mix(this.fromRadius, this.toRadius, h)
    );
  }

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      const xMin = Math.min(this.from.x - this.fromRadius, this.to.x - this.toRadius);
      const yMin = Math.min(this.from.y - this.fromRadius, this.to.y - this.toRadius);
      const xMax = Math.max(this.from.x + this.fromRadius, this.to.x + this.toRadius);
      const yMax = Math.max(this.from.y + this.fromRadius, this.to.y + this.toRadius);
      this._boundingBox = new ImmutableBoundingBox(xMin, xMax, yMin, yMax);
    }

    return this._boundingBox;
  }

  public get gameObject(): TunnelPhysical {
    return this;
  }

  public toJSON(): any {
    const { type, id, from, to, fromRadius, toRadius } = this;
    return [type, id, from, to, fromRadius, toRadius];
  }
}
