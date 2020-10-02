import { vec2 } from 'gl-matrix';
import { Circle } from 'sdf-2d';
import { GameObject } from '../../objects/game-object';

export class CircleShape extends Circle {
  public constructor(
    center = vec2.create(),
    radius = 0,
    public readonly gameObject: GameObject = null
  ) {
    super(center, radius);
  }

  public clone(): CircleShape {
    return new CircleShape(vec2.clone(this.center), this.radius, this.gameObject);
  }
}
