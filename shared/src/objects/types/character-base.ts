import { Id } from '../../communication/communication';
import { Circle } from '../../helper/circle';
import { serializable } from '../../serialization/serializable';
import { GameObject } from '../game-object';

export enum CharacterTeam {
  blue = 'blue',
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
    public head: Circle,
    public leftFoot: Circle,
    public rightFoot: Circle,
  ) {
    super(id);
  }

  public onShoot(_strength: number) {}

  public onLeap() {}

  public onHitConfirmed(_charge?: number) {}

  public onKillConfirmed(_victimName?: string, _streak?: number, _charge?: number) {}

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
