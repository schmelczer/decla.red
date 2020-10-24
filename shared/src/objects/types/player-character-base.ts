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
