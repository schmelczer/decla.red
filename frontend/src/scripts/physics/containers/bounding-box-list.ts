import { BoundingBoxBase } from './bounding-box-base';

export class BoundingBoxList {
  constructor(private boundingBoxes: Array<BoundingBoxBase> = []) {}

  public insert(box: BoundingBoxBase) {
    this.boundingBoxes.push(box);
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return this.boundingBoxes.filter((b) => b.intersects(box));
  }
}
