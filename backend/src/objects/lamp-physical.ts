import { vec2, vec3 } from 'gl-matrix';
import { LampBase, settings, id, serializable } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';

import { Physical } from '../physics/physical';

@serializable(LampBase)
export class LampPhysical extends LampBase implements Physical {
  public readonly canCollide = false;
  public readonly isInverted = false;
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
        this.center.y + settings.lightCutoffDistance
      );
    }

    return this._boundingBox;
  }

  public get gameObject(): LampPhysical {
    return this;
  }

  // todo
  public distance(_: vec2): number {
    return 0;
  }
}
