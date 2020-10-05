import { GameObject, Id } from 'shared';
import { BoundingBoxBase } from './bounds/bounding-box-base';

import { BoundingBoxList } from './containers/bounding-box-list';
import { BoundingBoxTree } from './containers/bounding-box-tree';
import { Command } from 'shared';
import { PhysicalGameObject } from './physical-game-object';
import { ImmutableBoundingBox } from './bounds/immutable-bounding-box';

export class PhysicalGameObjectContainer {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList: Array<ImmutableBoundingBox> = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();

  protected objects: Map<Id, GameObject> = new Map();
  private objectsGroupedByAbilities: Map<string, Array<GameObject>> = new Map();

  public initialize() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }

  public addObject(object: PhysicalGameObject, isDynamic) {
    this.objects.set(object.id, object);

    for (const command of this.objectsGroupedByAbilities.keys()) {
      if (object.reactsToCommand(command)) {
        this.objectsGroupedByAbilities.get(command).push(object);
      }
    }

    if (isDynamic) {
      this.dynamicBoundingBoxes.insert(object.getBoundingBox());
    } else {
      if (!this.isTreeInitialized) {
        this.staticBoundingBoxesWaitList.push(object.getBoundingBox());
      } else {
        this.staticBoundingBoxes.insert(object.getBoundingBox());
      }
    }
  }

  public removeObject(object: PhysicalGameObject) {
    this.objects.delete(object.id);

    for (const command of this.objectsGroupedByAbilities.keys()) {
      if (object.reactsToCommand(command)) {
        const array = this.objectsGroupedByAbilities.get(command);
        array.splice(
          array.findIndex((i) => i.id == object.id),
          1
        );
      }
    }

    this.dynamicBoundingBoxes.remove(object.getBoundingBox());
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

  public findIntersecting(box: BoundingBoxBase): Array<PhysicalGameObject> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ].map((b) => b.owner);
  }
}
