/*import { vec2 } from 'gl-matrix';
import { clamp } from '../../helper/clamp';
import { settings } from '../../settings';
import { PhysicalGameObject } from '../physical-object';
import { Physics } from '../physics';
import { BoundingCircle } from './bounding-circle';

export class PhysicsCircle extends BoundingCircle {
  private velocity = vec2.create();
  private _isAirborne = true;

  public get isAirborne(): boolean {
    return this._isAirborne;
  }

  constructor(
    private readonly physics: Physics,
    owner: PhysicalGameObject,
    center: vec2,
    radius: number
  ) {
    super(owner, center, radius);
  }

  public resetVelocity() {
    this.velocity = vec2.create();
  }

  public applyForce(force: vec2, timeInMilliseconds: number) {
    vec2.add(
      this.velocity,
      this.velocity,
      vec2.scale(vec2.create(), force, timeInMilliseconds)
    );

    vec2.set(
      this.velocity,
      clamp(this.velocity.x, -settings.maxVelocityX, settings.maxVelocityX),
      clamp(this.velocity.y, -settings.maxVelocityY, settings.maxVelocityY)
    );
  }

  public step(timeInMilliseconds: number): boolean {
    vec2.scale(
      this.velocity,
      this.velocity,
      Math.pow(settings.velocityAttenuation, timeInMilliseconds)
    );
    const distance = vec2.scale(vec2.create(), this.velocity, timeInMilliseconds);
    const distanceLength = vec2.length(distance);
    const stepCount = Math.ceil(distanceLength / settings.physicsMaxStep);
    vec2.scale(distance, distance, 1 / stepCount);

    let wasHit = false;

    for (let i = 0; i < stepCount; i++) {
      const { normal, tangent, hitSurface } = this.physics.tryMovingDynamicCircle(
        this,
        distance
      );
      if (hitSurface) {
        vec2.scale(this.velocity, tangent, vec2.dot(tangent, this.velocity));
        wasHit = true;
      }

      this._isAirborne = !(
        hitSurface && vec2.dot(normal, settings.gravitationalForce) < 0
      );
    }

    return wasHit;
  }
}
*/
