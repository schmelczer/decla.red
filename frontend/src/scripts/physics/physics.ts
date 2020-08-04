import { BoundingBoxTree } from './containers/bounding-box-tree';
import { BoundingBoxList } from './containers/bounding-box-list';
import { ImmutableBoundingBox } from './containers/immutable-bounding-box';
import { BoundingBoxBase } from './containers/bounding-box-base';

export class Physics {
  private staticBoundingBoxesWaitList = [];
  private isTreeInitialized = false;
  private staticBoundingBoxes = new BoundingBoxTree();

  private dynamicBoundingBoxes = new BoundingBoxList();

  public addStaticBoundingBox(boundingBox: ImmutableBoundingBox) {
    this.staticBoundingBoxesWaitList.push(boundingBox);
  }

  public addDynamicBoundingBox(boundingBox: BoundingBoxBase) {
    if (this.isTreeInitialized) {
      this.staticBoundingBoxes.insert(boundingBox);
    } else {
      this.dynamicBoundingBoxes.insert(boundingBox);
    }
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
