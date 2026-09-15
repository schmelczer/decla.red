import { vec2, vec3 } from 'gl-matrix';
import { Id } from '../../communication/communication';
import { serializable } from '../../serialization/serializable';
import { GameObject } from '../game-object';

@serializable
export class LampBase extends GameObject {
  constructor(
    id: Id,
    public center: vec2,
    public color: vec3,
    public lightness: number,
  ) {
    super(id);
  }

  public setLight(_color: vec3, _lightness: number) {}

  public toArray(): Array<any> {
    return [this.id, this.center, this.color, this.lightness];
  }
}
