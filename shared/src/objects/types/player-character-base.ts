import { CharacterBase } from './character-base';
import { Circle } from '../../helper/circle';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { CharacterTeam } from './character-team';

@serializable
export class PlayerCharacterBase extends CharacterBase {
  constructor(
    id: Id,
    public name: string,
    colorIndex: number,
    team: CharacterTeam,
    health: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, colorIndex, team, health, head, leftFoot, rightFoot);
  }

  public toArray(): Array<any> {
    const { id, name, colorIndex, team, health, head, leftFoot, rightFoot } = this;
    return [id, name, colorIndex, team, health, head, leftFoot, rightFoot];
  }
}
