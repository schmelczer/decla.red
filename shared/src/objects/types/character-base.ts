import { Id } from '../../communication/id';
import { Circle } from '../../helper/circle';
import { serializable } from '../../serialization/serializable';
import { GameObject } from '../game-object';

export enum CharacterTeam {
  decla = 'decla',
  neutral = 'neutral',
  red = 'red',
}

@serializable
export class CharacterBase extends GameObject {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onShoot(strength: number) {}

  public setHealth(health: number) {
    this.health = health;
  }

  public onDie() {}

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
