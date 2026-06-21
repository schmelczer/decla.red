import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';
import { sdfNormal } from './sdf-normal';

export interface MarchResult {
  hitSurface: boolean;
  normal?: vec2;
  hitObject?: Sdf;
}

// Raymarch a circle by `delta`, stopping at the first surface it would overlap.
// Extracted verbatim from the backend's move-circle so server and client
// resolve motion identically. The collision *reaction* is no longer dispatched
// here: on a real (non-ignored) hit, `onHit(intersecting)` is invoked at the
// exact point the backend used to dispatch its ReactToCollisionCommands, and
// the backend wrapper supplies that callback. The client passes none.
export const marchCircle = (
  body: PhysicsBody,
  delta: vec2,
  possibleIntersectors: Array<Sdf>,
  ignoreCollision = false,
  onHit?: (intersecting: Sdf) => void,
): MarchResult => {
  const direction = vec2.clone(delta);

  if (vec2.length(delta) > 0) {
    vec2.normalize(direction, direction);
  }

  const deltaLength = vec2.length(delta);
  let travelled = 0;
  const rayEnd = vec2.create();
  let prevMinDistance = 0;
  while (travelled < deltaLength) {
    travelled += prevMinDistance;
    vec2.add(
      rayEnd,
      body.center,
      vec2.scale(vec2.create(), direction, Math.min(travelled, deltaLength)),
    );

    const minDistance = evaluateSdf(rayEnd, possibleIntersectors);

    if (minDistance < body.radius) {
      const intersecting = possibleIntersectors.find(
        (i) => i.distance(rayEnd) <= body.radius,
      )!;

      if (ignoreCollision) {
        body.center = vec2.add(body.center, body.center, delta);
      } else {
        onHit?.(intersecting);
      }

      vec2.add(
        rayEnd,
        body.center,
        vec2.scale(vec2.create(), direction, travelled - prevMinDistance),
      );

      vec2.copy(body.center, rayEnd);

      const normal = sdfNormal(rayEnd, [intersecting]);
      return {
        hitSurface: true,
        normal,
        hitObject: intersecting,
      };
    }

    prevMinDistance = minDistance;
  }

  vec2.add(body.center, body.center, delta);

  return {
    hitSurface: false,
  };
};
