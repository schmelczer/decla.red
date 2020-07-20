import { Typed } from '../transport/serializable';
import { Vec2 } from './vec2';

export class Rectangle extends Typed {
  public constructor(
    public topLeft: Vec2 = new Vec2(),
    public size: Vec2 = new Vec2()
  ) {
    super();
  }

  public isInside(position: Vec2): boolean {
    const translated = position.subtract(this.topLeft);
    return (
      0 <= translated.x &&
      translated.x < this.size.x &&
      0 <= translated.y &&
      translated.y < this.size.y
    );
  }
}
