import { vec2 } from 'gl-matrix';

export class Circle {
  public constructor(public center: vec2, public radius: number) {}

  public isInside(position: vec2): boolean {
    const distance = vec2.distance(this.center, position);
    return distance < this.radius;
  }

  public areIntersecting(other: Circle): boolean {
    const distance = vec2.distance(this.center, other.center);
    return distance < this.radius + other.radius;
  }
}
