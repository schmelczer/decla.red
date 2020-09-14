import { vec2 } from 'gl-matrix';
import { GameObject } from '../../objects/game-object';
import { BoundingBox } from '../bounding-box';
import { IShape } from '../i-shape';
import { Circle } from './circle';

export class Blob implements IShape {
  public readonly boundingCircleRadius = 100;

  protected readonly headRadius = 40;
  protected readonly footRadius = 15;

  private readonly headOffset = vec2.fromValues(0, -15);
  private readonly leftFootOffset = vec2.fromValues(-12, -60);
  private readonly rightFootOffset = vec2.fromValues(12, -60);

  public readonly isInverted = false;
  protected boundingCircle = new Circle(vec2.create(), this.boundingCircleRadius);
  protected head = new Circle(vec2.create(), this.headRadius);
  protected leftFoot = new Circle(vec2.create(), this.footRadius);
  protected rightFoot = new Circle(vec2.create(), this.footRadius);
  public constructor(center: vec2, public readonly gameObject: GameObject = null) {
    this.position = center;
  }

  public set position(value: vec2) {
    vec2.copy(this.boundingCircle.center, value);
    vec2.add(this.head.center, value, this.headOffset);
    vec2.add(this.leftFoot.center, value, this.leftFootOffset);
    vec2.add(this.rightFoot.center, value, this.rightFootOffset);
  }

  public get center(): vec2 {
    return this.boundingCircle.center;
  }

  public get radius(): number {
    return this.boundingCircle.radius;
  }

  public distance(target: vec2): number {
    return this.boundingCircle.distance(target);
  }

  public normal(from: vec2): vec2 {
    return this.boundingCircle.normal(from);
  }

  public get boundingBox(): BoundingBox {
    return this.boundingCircle.boundingBox;
  }

  public isInside(target: vec2): boolean {
    return this.distance(target) < 0;
  }

  public clone(): Blob {
    return new Blob(this.boundingCircle.center, this.gameObject);
  }
}
