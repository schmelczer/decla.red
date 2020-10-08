import { vec2 } from 'gl-matrix';
import { Circle } from 'shared';
import { CirclePhysical } from './circle-physical';

export class Spring {
  constructor(
    private a: CirclePhysical | Circle,
    private b: CirclePhysical | Circle,
    private distance: number,
    private strength: number,
  ) {}

  public step(deltaTimeInSeconds: number) {
    Spring.step(this.a, this.b, this.distance, this.strength, deltaTimeInSeconds);
  }

  public static step(
    a: CirclePhysical | Circle,
    b: CirclePhysical | Circle,
    distance: number,
    strength: number,
    deltaTimeInSeconds: number,
  ) {
    const length = vec2.dist(a.center, b.center) - distance;

    const abDirection = vec2.subtract(vec2.create(), b.center, a.center);
    vec2.normalize(abDirection, abDirection);
    const force = vec2.scale(abDirection, abDirection, strength * length);
    if (a instanceof CirclePhysical) {
      a.applyForce(force, deltaTimeInSeconds);
    }
    if (b instanceof CirclePhysical) {
      vec2.scale(force, force, -1);
      b.applyForce(force, deltaTimeInSeconds);
    }
  }
}
