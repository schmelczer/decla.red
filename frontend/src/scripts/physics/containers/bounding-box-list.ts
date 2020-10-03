import { BoundingBoxBase } from '../bounds/bounding-box-base';

export class BoundingBoxList {
  constructor(private boundingBoxes: Array<BoundingBoxBase> = []) {}

  public insert(box: BoundingBoxBase) {
    this.boundingBoxes.push(box);
  }

  public remove(box: BoundingBoxBase) {
    this.boundingBoxes.splice(
      this.boundingBoxes.findIndex((i) => i === box),
      1
    );
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return this.boundingBoxes.filter((b) => b.intersects(box));
  }
}
