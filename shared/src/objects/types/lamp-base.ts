import { vec2, vec3 } from 'gl-matrix';
import { Id, serializable } from '../../main';
import { GameObject } from '../game-object';

@serializable
export class LampBase extends GameObject {
  constructor(id: Id, public center: vec2, public color: vec3, public lightness: number) {
    super(id);
  }

  public toArray(): Array<any> {
    const { id, center, color, lightness } = this as any;
    return [id, center, color, lightness];
  }
}
