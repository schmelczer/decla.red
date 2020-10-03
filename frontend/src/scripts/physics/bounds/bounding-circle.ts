import { vec2 } from 'gl-matrix';
import { PhysicalObject } from '../physical-object';
import { BoundingBox } from './bounding-box';
import { BoundingBoxBase } from './bounding-box-base';

export class BoundingCircle {
  private _boundingBox: BoundingBox;

  constructor(
    public readonly owner: PhysicalObject,
    private _center: vec2,
    private _radius: number
  ) {
    this._boundingBox = new BoundingBox(owner);
    this.recalculateBoundingBox();
  }

  public get center(): vec2 {
    return this._center;
  }

  public set center(value: vec2) {
    this._center = value;
    this.recalculateBoundingBox();
  }

  public get radius(): number {
    return this._radius;
  }

  public set radius(value: number) {
    this._radius = value;
    this.recalculateBoundingBox();
  }

  public distance(target: vec2): number {
    return vec2.distance(target, this.center) - this.radius;
  }

  public distanceBetween(target: BoundingCircle): number {
    return vec2.distance(target.center, this.center) - this.radius - target.radius;
  }

  public areIntersecting(other: PhysicalObject): boolean {
    return other.distance(this.center) < this.radius;
  }

  public isInside(other: PhysicalObject): boolean {
    return other.distance(this.center) < -this.radius;
  }

  public getPerimeterPoints(count: number): Array<vec2> {
    const result: Array<vec2> = [];
    for (let i = 0; i < count; i++) {
      result.push(
        vec2.fromValues(
          Math.cos((2 * Math.PI * i) / count) * this.radius + this.center.x,
          Math.sin((2 * Math.PI * i) / count) * this.radius + this.center.y
        )
      );
    }
    return result;
  }

  public get boundingBox(): BoundingBoxBase {
    return this._boundingBox;
  }

  private recalculateBoundingBox() {
    this._boundingBox.xMin = this.center.x - this._radius;
    this._boundingBox.xMax = this.center.x + this._radius;
    this._boundingBox.yMin = this.center.y - this._radius;
    this._boundingBox.yMax = this.center.y + this._radius;
  }
}
