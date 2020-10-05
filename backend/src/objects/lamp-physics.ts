import { vec2, vec3 } from 'gl-matrix';
import { LampBase, settings, id } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounds/immutable-bounding-box';
import { PhysicalGameObject } from '../physics/physical-game-object';

export class LampPhysics extends LampBase implements PhysicalGameObject {
  public readonly canCollide = false;
  public readonly isInverted = false;
  public readonly canMove = false;

  constructor(center: vec2, color: vec3, lightness: number) {
    super(id(), center, color, lightness);
  }

  private boundingBox?: ImmutableBoundingBox;

  public getBoundingBox(): ImmutableBoundingBox {
    if (!this.boundingBox) {
      this.boundingBox = new ImmutableBoundingBox(
        this,
        this.center.x - settings.lightCutoffDistance,
        this.center.x + settings.lightCutoffDistance,
        this.center.y - settings.lightCutoffDistance,
        this.center.y + settings.lightCutoffDistance
      );
    }

    return this.boundingBox;
  }

  public toJSON(): any {
    const { type, id, center, color, lightness } = this;
    return [type, id, center, color, lightness];
  }
}
