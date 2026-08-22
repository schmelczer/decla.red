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
// Shared so server and client resolve motion identically; the collision reaction
// is not dispatched here — on a real hit `onHit(intersecting)` is invoked by the
// caller. Advances by the free gap (distance minus radius), as sphere-tracing requires.
export const marchCircle = (
  body: PhysicsBody,
  delta: vec2,
  possibleIntersectors: Array<Sdf>,
  ignoreCollision = false,
  onHit?: (intersecting: Sdf) => void,
): MarchResult => {
  const deltaLength = vec2.length(delta);

  // Zero-length move cannot resolve a contact by advancing; report no hit so a
  // caller looping on `hitSurface` doesn't spin forever.
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
        // Pass through, but still report the contact so repeated marches keep progressing.
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

  // lastFreeDistance, not deltaLength: on a completed march they are equal, and
  // if the step budget ran out it is the furthest point actually checked.
  vec2.scaleAndAdd(body.center, body.center, direction, lastFreeDistance);

  return {
    hitSurface: false,
  };
};
