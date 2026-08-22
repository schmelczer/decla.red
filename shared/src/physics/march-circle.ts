import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';
import { sdfNormal } from './sdf-normal';

export interface MarchResult {
  hitSurface: boolean;
  normal?: vec2;
  hitObject?: Sdf;
}

const minimumStep = 0.5;
const maximumSteps = 256;

// Raymarch a circle by `delta`, stopping at the first surface it would overlap.
// Shared so server and client resolve motion identically. The collision
// *reaction* is not dispatched here: on a real (non-ignored) hit,
// `onHit(intersecting)` is invoked at the point the backend used to dispatch its
// ReactToCollisionCommands, and the backend wrapper supplies that callback. The
// client passes none.
//
// The march advances by the *free gap* (distance minus the circle's radius),
// which is what sphere-tracing a circle of radius r requires.
export const marchCircle = (
  body: PhysicsBody,
  delta: vec2,
  possibleIntersectors: Array<Sdf>,
  ignoreCollision = false,
  onHit?: (intersecting: Sdf) => void,
): MarchResult => {
  const deltaLength = vec2.length(delta);

  // A zero-length move cannot resolve a contact by advancing, so report no hit
  // rather than letting a caller that loops on `hitSurface` spin forever.
  if (!(deltaLength > 0)) {
    return { hitSurface: false };
  }

  const direction = vec2.normalize(vec2.create(), delta);

  const rayEnd = vec2.create();
  let travelled = 0;
  // Furthest point along the ray known to be overlap-free; a hit rewinds here.
  let lastFreeDistance = 0;

  for (let step = 0; step < maximumSteps; step++) {
    vec2.scaleAndAdd(rayEnd, body.center, direction, travelled);

    const minDistance = evaluateSdf(rayEnd, possibleIntersectors);

    if (minDistance < body.radius) {
      const intersecting = possibleIntersectors.find(
        (i) => i.distance(rayEnd) <= body.radius,
      )!;

      if (ignoreCollision) {
        // Pass straight through, but still report the contact so callers that
        // march repeatedly to escape geometry keep making progress.
        vec2.scaleAndAdd(body.center, body.center, direction, deltaLength);
        return { hitSurface: true, hitObject: intersecting };
      }

      onHit?.(intersecting);

      vec2.scaleAndAdd(rayEnd, body.center, direction, lastFreeDistance);
      vec2.copy(body.center, rayEnd);

      return {
        hitSurface: true,
        normal: sdfNormal(rayEnd, [intersecting]),
        hitObject: intersecting,
      };
    }

    lastFreeDistance = travelled;

    if (travelled >= deltaLength) {
      break;
    }

    travelled = Math.min(
      travelled + Math.max(minDistance - body.radius, minimumStep),
      deltaLength,
    );
  }

  vec2.scaleAndAdd(body.center, body.center, direction, deltaLength);

  return {
    hitSurface: false,
  };
};
