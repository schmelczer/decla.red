import { Circle } from '../../helper/circle';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';
import { CharacterTeam } from './character-team';

@serializable
export class CharacterBase extends GameObject {
  constructor(
    id: Id,
    public colorIndex: number,
    public team: CharacterTeam,
    public health: number,
    public head?: Circle,
    public leftFoot?: Circle,
    public rightFoot?: Circle,
  ) {
    super(id);
  }

  public toArray(): Array<any> {
    const { id, colorIndex, team, health, head, leftFoot, rightFoot } = this;
    return [id, colorIndex, team, health, head, leftFoot, rightFoot];
  }
}
