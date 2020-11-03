import { vec2 } from 'gl-matrix';
import { settings } from '../../settings';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';
import { CharacterTeam } from './character-team';

@serializable
export class ProjectileBase extends GameObject {
  constructor(
    id: Id,
    public center: vec2,
    public radius: number,
    public team: CharacterTeam,
    public strength: number,
  ) {
    super(id);
  }

  public step(deltaTimeInSeconds: number) {
    this.strength -= settings.projectileFadeSpeed * deltaTimeInSeconds;
    this.strength = Math.max(0, this.strength);
  }

  public toArray(): Array<any> {
    return [this.id, this.center, this.radius, this.team, this.strength];
  }
}
