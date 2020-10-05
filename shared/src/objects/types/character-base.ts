import { vec2 } from 'gl-matrix';
import { Circle } from '../../helper/circle';
import { Id } from '../../main';
import { GameObject } from '../game-object';

export abstract class CharacterBase extends GameObject {
  public static readonly type = 'Character';

  constructor(
    id: Id,
    public head: Circle,
    public leftFoot: Circle,
    public rightFoot: Circle
  ) {
    super(id);
  }
}
