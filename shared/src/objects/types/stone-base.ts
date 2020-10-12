import { vec2 } from 'gl-matrix';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';

@serializable
export class StoneBase extends GameObject {
  constructor(id: Id, public readonly vertices: Array<vec2>) {
    super(id);
  }

  public toArray(): Array<any> {
    return [this.id, this.vertices];
  }
}
