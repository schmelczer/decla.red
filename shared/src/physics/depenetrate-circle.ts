import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';
import { sdfNormal } from './sdf-normal';

// marchCircle assumes an overlap-free start (inside, it registers a zero-
// distance hit and never moves), so any overlap from rotating surfaces must be
// resolved here before marching.
export const depenetrateCircle = (
  body: PhysicsBody,
  possibleIntersectors: Array<Sdf>,
) => {
  for (let i = 0; i < 4; i++) {
    const distance = evaluateSdf(body.center, possibleIntersectors);
    if (distance >= body.radius) {
      return;
    }

    const normal = sdfNormal(body.center, possibleIntersectors);
    if (vec2.squaredLength(normal) === 0) {
      return;
    }

    vec2.copy(body.lastNormal, normal);
    vec2.scaleAndAdd(body.center, body.center, normal, body.radius - distance + 0.01);
  }
};
