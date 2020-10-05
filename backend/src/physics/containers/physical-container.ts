import { GameObject, Id } from 'shared';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

import { BoundingBoxList } from './bounding-box-list';
import { BoundingBoxTree } from './bounding-box-tree';
import { Command } from 'shared';
import { Physical } from '../physical';
import { StaticPhysical } from './static-physical-object';

export class PhysicalContainer {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList: Array<StaticPhysical> = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();

  protected objects: Map<Id, GameObject> = new Map();
  private objectsGroupedByAbilities: Map<string, Array<GameObject>> = new Map();

  public initialize() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }

  public addObject(object: Physical) {
    this.objects.set(object.gameObject.id, object.gameObject);

    for (const command of this.objectsGroupedByAbilities.keys()) {
      if (object.gameObject.reactsToCommand(command)) {
        this.objectsGroupedByAbilities.get(command).push(object.gameObject);
      }
    }

    this.addPhysical(object);
  }

  public addPhysical(physical: Physical) {
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

  public removeObject(object: Physical) {
    this.objects.delete(object.gameObject.id);

    for (const command of this.objectsGroupedByAbilities.keys()) {
      if (object.gameObject.reactsToCommand(command)) {
        const array = this.objectsGroupedByAbilities.get(command);
        array.splice(
          array.findIndex((i) => i.id == object.gameObject.id),
          1
        );
      }
    }

    this.dynamicBoundingBoxes.remove(object);
  }

  public sendCommand(e: Command) {
    if (!this.objectsGroupedByAbilities.has(e.type)) {
      this.createGroupForCommand(e.type);
    }

    this.objectsGroupedByAbilities.get(e.type).forEach((o, _) => o.sendCommand(e));
  }

  private createGroupForCommand(commandType: string) {
    const objectsReactingToCommand = [];

    this.objects.forEach((o, _) => {
      if (o.reactsToCommand(commandType)) {
        objectsReactingToCommand.push(o);
      }
    });

    this.objectsGroupedByAbilities.set(commandType, objectsReactingToCommand);
  }

  public findIntersecting(box: BoundingBoxBase): Array<Physical> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }
}
