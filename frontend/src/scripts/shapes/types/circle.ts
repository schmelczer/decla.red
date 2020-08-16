import { vec2 } from 'gl-matrix';
import { IShape } from '../i-shape';
import { BoundingBox } from '../bounding-box';

export class Circle implements IShape {
  public readonly isInverted = false;

  public constructor(public center = vec2.create(), public radius = 0) {}

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

  public areIntersecting(other: Circle): boolean {
    const distance = vec2.distance(this.center, other.center);
    return distance < this.radius + other.radius;
  }

  public clone(): Circle {
    return new Circle(this.center, this.radius);
  }
}
