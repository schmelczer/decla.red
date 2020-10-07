import { vec2 } from 'gl-matrix';
import { serializable } from '../transport/serialization/serializable';

@serializable
export class Circle {
  constructor(public center: vec2, public radius: number) {}

  public toArray(): Array<any> {
    return [this.center, this.radius];
  }
}
