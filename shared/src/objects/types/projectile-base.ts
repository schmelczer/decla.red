import { vec2 } from 'gl-matrix';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';

@serializable
export class ProjectileBase extends GameObject {
  constructor(
    id: Id,
    public center: vec2,
    public radius: number,
    public colorIndex: number,
    public strength: number,
  ) {
    super(id);
  }

  public toArray(): Array<any> {
    return [this.id, this.center, this.radius, this.colorIndex, this.strength];
  }
}
