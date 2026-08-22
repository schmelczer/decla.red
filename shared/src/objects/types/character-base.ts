import { Id } from '../../communication/communication';
import { Circle } from '../../helper/circle';
import { serializable } from '../../serialization/serializable';
import { toArrayFromFields } from '../../serialization/serialized-fields';
import { GameObject } from '../game-object';

export enum CharacterTeam {
  blue = 'blue',
  neutral = 'neutral',
  red = 'red',
}

@serializable
export class CharacterBase extends GameObject {
  private static readonly serializedFields = [
    'id',
    'name',
    'killCount',
    'deathCount',
    'team',
    'health',
    'head',
    'leftFoot',
    'rightFoot',
  ] as const;

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

  public onLeap() {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onHitConfirmed(charge?: number) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onKillConfirmed(victimName?: string, streak?: number, charge?: number) {}

  public setHealth(health: number) {
    this.health = health;
  }

  public onDie() {}

  public setKillCount(killCount: number) {
    this.killCount = killCount;
  }

  public toArray(): Array<any> {
    return toArrayFromFields(this, CharacterBase.serializedFields);
  }
}
