import { Typed } from '../transport/serializable';
import { vec2 } from 'gl-matrix';

export class Rectangle extends Typed {
  public constructor(
    public topLeft: vec2 = vec2.create(),
    public size: vec2 = vec2.create()
  ) {
    super();
  }

  public isInside(position: vec2): boolean {
    const translated = vec2.subtract(vec2.create(), position, this.topLeft);
    return (
      0 <= translated.x &&
      translated.x < this.size.x &&
      0 <= translated.y &&
      translated.y < this.size.y
    );
  }
}
