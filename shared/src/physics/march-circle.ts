import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';
import { sdfNormal } from './sdf-normal';

export interface MarchResult {
  travelled: number;
  normal?: vec2;
  hitObject?: Sdf;
}

const minimumStep = 0.5;
const maximumSteps = 256;

export const marchCircle = (
  body: PhysicsBody,
  delta: vec2,
  possibleIntersectors: Array<Sdf>,
  onHit?: (intersecting: Sdf) => void,
): MarchResult => {
  const deltaLength = vec2.length(delta);
  if (!(deltaLength > 0)) {
    return { travelled: 0 };
  }

  const direction = vec2.normalize(vec2.create(), delta);
  const rayEnd = vec2.create();
  let travelled = 0;
  let lastFreeDistance = 0;

  for (let step = 0; step < maximumSteps; step++) {
    vec2.scaleAndAdd(rayEnd, body.center, direction, travelled);

    const minDistance = evaluateSdf(rayEnd, possibleIntersectors);

    if (minDistance < body.radius) {
      const intersecting = possibleIntersectors.find(
        (i) => i.canCollide && i.distance(rayEnd) < body.radius,
      )!;

      vec2.scaleAndAdd(rayEnd, body.center, direction, lastFreeDistance);
      vec2.copy(body.center, rayEnd);
      const normal = sdfNormal(rayEnd, [intersecting]);
      onHit?.(intersecting);

      return {
        travelled: lastFreeDistance,
        normal,
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

  vec2.scaleAndAdd(body.center, body.center, direction, lastFreeDistance);

  return { travelled: lastFreeDistance };
};
