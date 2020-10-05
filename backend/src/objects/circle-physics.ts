import { vec2 } from 'gl-matrix';
import { Circle } from 'shared';
import { BoundingBox } from '../physics/bounds/bounding-box';
import { BoundingBoxBase } from '../physics/bounds/bounding-box-base';

export class CirclePhysics implements Circle {
  private _boundingBox: BoundingBox;

  constructor(private _center: vec2, private _radius: number) {
    this._boundingBox = new BoundingBox(null);
    this.recalculateBoundingBox();
  }

  public get boundingBox(): BoundingBoxBase {
    return this._boundingBox;
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

  public distanceBetween(target: CirclePhysics): number {
    return vec2.distance(target.center, this.center) - this.radius - target.radius;
  }

  public areIntersecting(other: CirclePhysics): boolean {
    return other.distance(this.center) < this.radius;
  }

  public isInside(other: CirclePhysics): boolean {
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

  private recalculateBoundingBox() {
    this._boundingBox.xMin = this.center.x - this._radius;
    this._boundingBox.xMax = this.center.x + this._radius;
    this._boundingBox.yMin = this.center.y - this._radius;
    this._boundingBox.yMax = this.center.y + this._radius;
  }

  public toJSON(): any {
    const { center, radius } = this;
    return { center, radius };
  }
}
