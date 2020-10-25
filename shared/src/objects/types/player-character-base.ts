import { Circle } from '../../helper/circle';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
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

  public updateCircles(head: Circle, leftFoot: Circle, rightFoot: Circle) {
    this.head!.center = head.center;
    this.head!.radius = head.radius;
    this.leftFoot!.center = leftFoot.center;
    this.leftFoot!.radius = leftFoot.radius;
    this.rightFoot!.center = rightFoot.center;
    this.rightFoot!.radius = rightFoot.radius;
  }

  public setHealth(health: number) {
    this.health = health;
  }

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
