import { vec2, vec3 } from 'gl-matrix';
import { LampBase, settings, id, serializesTo } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { StaticPhysical } from '../physics/containers/static-physical';

@serializesTo(LampBase)
export class LampPhysical extends LampBase implements StaticPhysical {
  public readonly canCollide = false;
  public readonly canMove = false;

  constructor(center: vec2, color: vec3, lightness: number) {
    super(id(), center, color, lightness);
  }

  private _boundingBox?: ImmutableBoundingBox;

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      this._boundingBox = new ImmutableBoundingBox(
        this.center.x - settings.lightCutoffDistance,
        this.center.x + settings.lightCutoffDistance,
        this.center.y - settings.lightCutoffDistance,
        this.center.y + settings.lightCutoffDistance,
      );
    }

    return this._boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public distance(target: vec2): number {
    return vec2.distance(this.center, target);
  }
}
