import { vec2 } from 'gl-matrix';
import { serializable } from '../transport/serialization/serializable';

@serializable
export class Rectangle {
  constructor(public topLeft = vec2.create(), public size = vec2.create()) {}

  public toArray(): Array<any> {
    return [this.topLeft, this.size];
  }
}
