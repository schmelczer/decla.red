import { vec2 } from 'gl-matrix';
import { Circle } from 'shared';
import { CirclePhysical } from '../../objects/circle-physical';

export const applySpringForce = (
  a: CirclePhysical | Circle,
  b: CirclePhysical | Circle,
  distance: number,
  strength: number,
  deltaTimeInSeconds: number,
) => {
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
};
