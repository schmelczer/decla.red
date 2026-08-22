import { vec2 } from 'gl-matrix';
import { settings } from '../../settings';
import { serializable } from '../../serialization/serializable';
import { toArrayFromFields } from '../../serialization/serialized-fields';
import { GameObject } from '../game-object';
import { Id } from '../../communication/communication';
import { CharacterTeam } from './character-base';

@serializable
export class ProjectileBase extends GameObject {
  private static readonly serializedFields = [
    'id',
    'center',
    'radius',
    'team',
    'strength',
  ] as const;

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
    return toArrayFromFields(this, ProjectileBase.serializedFields);
  }
}
