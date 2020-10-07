import { Circle } from '../../helper/circle';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';

@serializable
export class CharacterBase extends GameObject {
  constructor(
    id: Id,
    public head: Circle,
    public leftFoot: Circle,
    public rightFoot: Circle,
  ) {
    super(id);
  }

  public toArray(): Array<any> {
    const { id, head, leftFoot, rightFoot } = this as any;
    return [id, head, leftFoot, rightFoot];
  }
}
