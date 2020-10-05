import { id, CharacterBase } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounds/immutable-bounding-box';
import { PhysicalGameObject } from '../physics/physical-game-object';
import { CirclePhysics } from './circle-physics';

export class CharacterPhysics extends CharacterBase implements PhysicalGameObject {
  public readonly canCollide = true;
  public readonly isInverted = false;
  public readonly canMove = true;

  constructor(head: CirclePhysics, leftFoot: CirclePhysics, rightFoot: CirclePhysics) {
    super(id(), head, leftFoot, rightFoot);
  }

  private boundingBox?: ImmutableBoundingBox;

  public getBoundingBox(): ImmutableBoundingBox {
    if (!this.boundingBox) {
      this.boundingBox = (this.head as CirclePhysics).boundingBox;
      (this.head as CirclePhysics).boundingBox.owner = this;
    }

    return this.boundingBox;
  }

  public toJSON(): any {
    const { type, id, head, leftFoot, rightFoot } = this;
    return [type, id, head, leftFoot, rightFoot];
  }
}
