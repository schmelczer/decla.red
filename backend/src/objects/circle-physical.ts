import { vec2 } from 'gl-matrix';
import { Circle, clamp, GameObject, serializesTo, settings } from 'shared';
import { Physical } from '../physics/physical';

import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { moveCircle } from '../physics/move-circle';
import { PhysicalContainer } from '../physics/containers/physical-container';

@serializesTo(Circle)
export class CirclePhysical implements Circle, Physical {
  readonly isInverted = false;
  readonly canCollide = true;
  readonly canMove = true;

  private _isAirborne = true;
  private velocity = vec2.create();

  public get isAirborne(): boolean {
    return this._isAirborne;
  }

  private _boundingBox: BoundingBox;

  constructor(
    private _center: vec2,
    private _radius: number,
    public owner: GameObject,
    private readonly container: PhysicalContainer,
  ) {
    this._boundingBox = new BoundingBox();
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

  public get gameObject(): GameObject {
    return this.owner;
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

  public distanceBetween(target: Circle): number {
    return vec2.distance(target.center, this.center) - this.radius - target.radius;
  }

  public areIntersecting(other: Physical): boolean {
    return other.distance(this.center) < this.radius;
  }

  public isInside(other: Physical): boolean {
    return other.distance(this.center) < -this.radius;
  }

  public getPerimeterPoints(count: number): Array<vec2> {
    const result: Array<vec2> = [];
    for (let i = 0; i < count; i++) {
      result.push(
        vec2.fromValues(
          Math.cos((2 * Math.PI * i) / count) * this.radius + this.center.x,
          Math.sin((2 * Math.PI * i) / count) * this.radius + this.center.y,
        ),
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

  public applyForce(force: vec2, timeInSeconds: number) {
    vec2.add(
      this.velocity,
      this.velocity,
      vec2.scale(vec2.create(), force, timeInSeconds),
    );

    vec2.set(
      this.velocity,
      clamp(this.velocity.x, -settings.maxVelocityX, settings.maxVelocityX),
      clamp(this.velocity.y, -settings.maxVelocityY, settings.maxVelocityY),
    );
  }

  public resetVelocity() {
    this.velocity = vec2.create();
  }

  public step(deltaTimeInSeconds: number): boolean {
    vec2.scale(
      this.velocity,
      this.velocity,
      Math.pow(settings.velocityAttenuation, deltaTimeInSeconds),
    );

    const distance = vec2.scale(vec2.create(), this.velocity, deltaTimeInSeconds);

    const distanceLength = vec2.length(distance);
    const stepCount = Math.ceil(distanceLength / settings.physicsMaxStep);
    vec2.scale(distance, distance, 1 / stepCount);

    let wasHit = false;

    for (let i = 0; i < stepCount; i++) {
      const { tangent, hitSurface } = moveCircle(
        this,
        vec2.clone(distance),
        this.container.findIntersecting(this.boundingBox),
      );

      if (hitSurface) {
        vec2.scale(this.velocity, tangent!, vec2.dot(tangent!, this.velocity));
        wasHit = true;
      }
    }

    this._isAirborne = !wasHit;
    return wasHit;
  }

  public toArray(): Array<any> {
    const { center, radius } = this;
    return [center, radius];
  }
}
