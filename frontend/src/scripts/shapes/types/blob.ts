import { vec2 } from 'gl-matrix';
import { IShape } from '../i-shape';
import { BoundingBox } from '../bounding-box';
import { Circle } from './circle';
import { settings } from '../../drawing/settings';
import { GameObject } from '../../objects/game-object';

export class Blob implements IShape {
  private static readonly boundingCircleRadius = 19;

  private static readonly headOffset = vec2.fromValues(0, 15);

  private static readonly torsoOffset = vec2.fromValues(0, 0);

  private static readonly leftFootOffset = vec2.fromValues(-5, -10);

  private static readonly rightFootOffset = vec2.fromValues(5, -10);

  public readonly isInverted = false;

  protected boundingCircle = new Circle(vec2.create(), Blob.boundingCircleRadius);

  protected head = new Circle(vec2.create(), settings.shaderMacros.headRadius);

  protected torso = new Circle(vec2.create(), settings.shaderMacros.torsoRadius);

  protected leftFoot = new Circle(vec2.create(), settings.shaderMacros.footRadius);

  protected rightFoot = new Circle(vec2.create(), settings.shaderMacros.footRadius);

  public constructor(center: vec2, public readonly gameObject: GameObject = null) {
    this.position = center;
  }

  public set position(value: vec2) {
    vec2.copy(this.boundingCircle.center, value);
    vec2.add(this.head.center, value, Blob.headOffset);
    vec2.add(this.torso.center, value, Blob.torsoOffset);
    vec2.add(this.leftFoot.center, value, Blob.leftFootOffset);
    vec2.add(this.rightFoot.center, value, Blob.rightFootOffset);
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
