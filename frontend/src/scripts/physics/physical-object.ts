/*import { vec2 } from 'gl-matrix';
import { GameObject } from '../objects/game-object';
import { BoundingBoxBase } from './bounds/bounding-box-base';
import { Physics } from './physics';

export abstract class PhysicalGameObject extends GameObject {
  public abstract getBoundingBox(): BoundingBoxBase;
  public abstract distance(target: vec2): number;
  public readonly isInverted: boolean = false;

  constructor(protected physics: Physics, public readonly canCollide: boolean) {
    super();
  }

  protected addToPhysics(isDynamic: boolean) {
    if (isDynamic) {
      this.physics.addDynamicBoundingBox(this.getBoundingBox());
    } else {
      this.physics.addStaticBoundingBox(this.getBoundingBox());
    }
  }
}
*/
