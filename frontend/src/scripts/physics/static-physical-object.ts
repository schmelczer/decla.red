import { PhysicalObject } from './physical-object';

export abstract class StaticPhysicalObject extends PhysicalObject {
  protected addToPhysics() {
    super.addToPhysics(false);
  }
}
