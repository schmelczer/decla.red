import { Id } from '../../communication/id';
import { Circle } from '../../helper/circle';
import { serializable } from '../../serialization/serializable';
import { GameObject } from '../game-object';
import { CharacterTeam } from './character-team';

@serializable
export class PlayerCharacterBase extends GameObject {
  constructor(
    id: Id,
    public name: string,
    public killCount: number,
    public deathCount: number,
    public team: CharacterTeam,
    public health: number,
    public head?: Circle,
    public leftFoot?: Circle,
    public rightFoot?: Circle,
  ) {
    super(id);
  }

  public onShoot(strength: number) {}

  public setHealth(health: number) {
    this.health = health;
  }

  public kill() {}

  public setKillCount(killCount: number) {
    this.killCount = killCount;
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
