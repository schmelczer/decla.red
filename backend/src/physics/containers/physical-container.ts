import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';
import { BoundingBoxList } from './bounding-box-list';
import { BoundingBoxTree } from './bounding-box-tree';
import { Physical } from '../physicals/physical';
import { StaticPhysical } from '../physicals/static-physical';
import { DynamicPhysical } from '../physicals/dynamic-physical';
import {
  GeneratesPoints,
  generatesPoints,
} from '../../objects/capabilities/generates-points';
import { timeDependent } from '../../objects/capabilities/time-dependent';

export class PhysicalContainer {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList: Array<StaticPhysical> = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();
  private objects: Array<Physical> = [];

  public initialize() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }

  public addObject(physical: Physical) {
    this.objects.push(physical);

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
    this.objects = this.objects.filter((p) => p !== object);
    this.dynamicBoundingBoxes.remove(object);
  }

  public stepObjects(deltaTime: number) {
    this.objects.forEach((o) => timeDependent(o) && o.step(deltaTime));
  }

  public resetRemoteCalls() {
    this.objects.forEach((o) => o.gameObject.resetRemoteCalls());
  }

  public getPointsGenerated(): { decla: number; red: number } {
    return this.objects
      .filter((o) => generatesPoints(o))
      .reduce(
        (sum, o) => {
          const { decla, red } = ((o as unknown) as GeneratesPoints).getPoints();
          return {
            decla: sum.decla + decla,
            red: sum.red + red,
          };
        },
        { decla: 0, red: 0 },
      );
  }

  public findIntersecting(box: BoundingBoxBase): Array<Physical> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }
}
