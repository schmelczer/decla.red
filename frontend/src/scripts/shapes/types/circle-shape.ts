import { vec2 } from 'gl-matrix';
import { Circle } from 'sdf-2d';
import { GameObject } from '../../objects/game-object';
import { BoundingBox } from '../bounding-box';
import { IShape } from '../i-shape';

export class CircleShape extends Circle implements IShape {
  public readonly isInverted = false;

  public constructor(
    center = vec2.create(),
    radius = 0,
    public readonly gameObject: GameObject = null
  ) {
    super(center, radius);
  }

  public distance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public normal(from: vec2): vec2 {
    const diff = vec2.subtract(vec2.create(), from, this.center);
    return vec2.normalize(diff, diff);
  }

  public get boundingBox(): BoundingBox {
    return new BoundingBox(
      this,
      this.center.x - this.radius,
      this.center.x + this.radius,
      this.center.y - this.radius,
      this.center.y + this.radius
    );
  }

  public isInside(target: vec2): boolean {
    return this.distance(target) < 0;
  }

  public areIntersecting(other: CircleShape): boolean {
    const distance = vec2.distance(this.center, other.center);
    return distance < this.radius + other.radius;
  }

  public clone(): CircleShape {
    return new CircleShape(vec2.clone(this.center), this.radius, this.gameObject);
  }
}
