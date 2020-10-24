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
    public killCount: number,
    public deathCount: number,
    team: CharacterTeam,
    health: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, team, health, head, leftFoot, rightFoot);
  }

  public toArray(): Array<any> {
    return [
      this.id,
      this.name,
      this.killCount,
      this.deathCount,
      this.team,
      this.health,
      this.head,
      this.leftFoot,
      this.rightFoot,
    ];
  }
}
