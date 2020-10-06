import { Circle } from '../../helper/circle';
import { Id } from '../../main';
import { GameObject } from '../game-object';

export abstract class CharacterBase extends GameObject {
  constructor(
    id: Id,
    public head: Circle,
    public leftFoot: Circle,
    public rightFoot: Circle
  ) {
    super(id);
  }
}
