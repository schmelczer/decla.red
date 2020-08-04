import { vec2 } from 'gl-matrix';
import { IPrimitive } from './i-primitive';
import { ImmutableBoundingBox } from '../../../physics/containers/immutable-bounding-box';
import { GameObject } from '../../../objects/game-object';

export class Circle implements IPrimitive {
  public constructor(
    public readonly owner: GameObject,
    public center = vec2.create(),
    public radius = 0
  ) {}

  public serializeToUniforms(uniforms: any): void {
    throw new Error('Method not implemented.');
  }

  public distance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public minimumDistance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public get boundingBox(): ImmutableBoundingBox {
    return new ImmutableBoundingBox(
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
}
