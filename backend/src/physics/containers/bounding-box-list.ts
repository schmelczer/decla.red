import { DynamicPhysical } from '../physicals/dynamic-physical';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

export class BoundingBoxList {
  constructor(private objects: Array<DynamicPhysical> = []) {}

  public insert(object: DynamicPhysical) {
    this.objects.push(object);
  }

  public remove(object: DynamicPhysical) {
    this.objects.splice(
      this.objects.findIndex((i) => i === object),
      1,
    );
  }

  public forEach(func: (object: DynamicPhysical) => unknown) {
    this.objects.forEach(func);
  }

  public findIntersecting(boundingBox: BoundingBoxBase): Array<DynamicPhysical> {
    return this.objects.filter((b) => b.boundingBox.intersects(boundingBox));
  }
}
