import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';
import { BoundingBoxList } from './bounding-box-list';
import { BoundingBoxTree } from './bounding-box-tree';
import { Physical } from '../physicals/physical';
import { StaticPhysical } from '../physicals/static-physical';
import { DynamicPhysical } from '../physicals/dynamic-physical';
import { Command, CommandReceiver } from 'shared';

export class PhysicalContainer extends CommandReceiver {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList: Array<StaticPhysical> = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();
  private objects: Array<Physical> = [];

  protected defaultCommandExecutor(c: Command) {
    this.objects.forEach((o) => o.handleCommand(c));
  }

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

  public resetRemoteCalls() {
    this.objects.forEach((o) => o.gameObject.resetRemoteCalls());
  }

  public findIntersecting(box: BoundingBoxBase): Array<Physical> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }
}
