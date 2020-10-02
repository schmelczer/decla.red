import { BoundingCircle } from './bounds/bounding-circle';
import { PhysicalObject } from './physical-object';

export abstract class DynamicPhysicalObject extends PhysicalObject {
  public abstract getBoundingCircles(): Array<BoundingCircle>;

  protected addToPhysics() {
    super.addToPhysics(true);
  }
}
