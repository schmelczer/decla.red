import { Physical } from '../physical';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

export class BoundingBoxList {
  constructor(private objects: Array<Physical> = []) {}

  public insert(object: Physical) {
    this.objects.push(object);
  }

  public remove(object: Physical) {
    this.objects.splice(
      this.objects.findIndex((i) => i === object),
      1
    );
  }

  public findIntersecting(boundingBox: BoundingBoxBase): Array<Physical> {
    return this.objects.filter((b) => b.boundingBox.intersects(boundingBox));
  }
}
