import { Typed } from '../transport/serializable';
import { Vec2 } from '../math/vec2';

export class GameObject extends Typed {
  public position = new Vec2();
  public boundingBoxSize = new Vec2();
}
