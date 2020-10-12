import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

import { BoundingBoxList } from './bounding-box-list';
import { BoundingBoxTree } from './bounding-box-tree';

import { Physical } from '../physical';
import { StaticPhysical } from './static-physical';
import { DynamicPhysical } from './dynamic-physical';

export class PhysicalContainer {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList: Array<StaticPhysical> = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();

  public initialize() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }

  public addObject(physical: Physical) {
    if (physical.canMove) {
      this.dynamicBoundingBoxes.insert(physical);
    } else {
      if (!this.isTreeInitialized) {
        this.staticBoundingBoxesWaitList.push(physical);
      } else {
        this.staticBoundingBoxes.insert(physical);
      }
    }
  }

  public removeObject(object: DynamicPhysical) {
    this.dynamicBoundingBoxes.remove(object);
  }

  public stepObjects(deltaTimeInMilliseconds: number) {
    this.dynamicBoundingBoxes.forEach((o) => o.step(deltaTimeInMilliseconds));
  }

  public findIntersecting(box: BoundingBoxBase): Array<Physical> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }
}
