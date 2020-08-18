import { BoundingBoxTree } from './containers/bounding-box-tree';
import { BoundingBoxList } from './containers/bounding-box-list';
import { ImmutableBoundingBox } from '../shapes/immutable-bounding-box';
import { BoundingBoxBase } from '../shapes/bounding-box-base';

export class Physics {
  private isTreeInitialized = false;

  private staticBoundingBoxesWaitList = [];

  private staticBoundingBoxes = new BoundingBoxTree();

  private dynamicBoundingBoxes = new BoundingBoxList();

  public addStaticBoundingBox(boundingBox: ImmutableBoundingBox) {
    if (!this.isTreeInitialized) {
      this.staticBoundingBoxesWaitList.push(boundingBox);
    } else {
      this.staticBoundingBoxes.insert(boundingBox);
    }
  }

  public addDynamicBoundingBox(boundingBox: BoundingBoxBase) {
    this.dynamicBoundingBoxes.insert(boundingBox);
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }

  public start() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }
}
