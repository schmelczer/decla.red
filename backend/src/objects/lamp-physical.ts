import { vec2, vec3 } from 'gl-matrix';
import { Circle, LampBase, settings, id, serializesTo } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { StaticPhysical } from '../physics/physicals/static-physical';

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
      this._boundingBox = getBoundingBoxOfCircle(
        new Circle(this.center, settings.lightCutoffDistance),
      );
    }

    return this._boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public queueSetLight(color: vec3, lightness: number) {
    this.color = vec3.clone(color);
    this.lightness = lightness;
    this.remoteCall('setLight', color, lightness);
  }

  public distance(target: vec2): number {
    return vec2.distance(this.center, target);
  }
}
