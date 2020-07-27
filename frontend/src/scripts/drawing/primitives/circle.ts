import { vec2 } from 'gl-matrix';
import { IPrimitive } from './i-primitive';

export class Circle implements IPrimitive {
  public constructor(public center: vec2, public radius: number) {}

  public distance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public minimumDistance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public isInside(target: vec2): boolean {
    return this.distance(target) < 0;
  }

  public areIntersecting(other: Circle): boolean {
    const distance = vec2.distance(this.center, other.center);
    return distance < this.radius + other.radius;
  }
}
