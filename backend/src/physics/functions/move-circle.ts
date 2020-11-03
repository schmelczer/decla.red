import { vec2 } from 'gl-matrix';
import { Circle, GameObject, rotate90Deg } from 'shared';
import { CirclePhysical } from '../../objects/circle-physical';
import { reactsToCollision } from '../physicals/reacts-to-collision';
import { evaluateSdf } from './evaluate-sdf';
import { Physical } from '../physicals/physical';

export const moveCircle = (
  circle: CirclePhysical,
  delta: vec2,
  possibleIntersectors: Array<Physical>,
  ignoreCollision = false,
): {
  realDelta: vec2;
  hitSurface: boolean;
  normal?: vec2;
  tangent?: vec2;
  hitObject?: GameObject;
} => {
  const direction = vec2.clone(delta);

  if (vec2.length(delta) > 0) {
    vec2.normalize(direction, direction);
  }

  const deltaLength = vec2.length(delta);
  let travelled = 0;
  let rayEnd = vec2.create();
  let prevMinDistance = 0;
  while (travelled < deltaLength) {
    travelled += prevMinDistance;
    vec2.add(
      rayEnd,
      circle.center,
      vec2.scale(vec2.create(), direction, Math.min(travelled, deltaLength)),
    );

    const minDistance = evaluateSdf(rayEnd, possibleIntersectors);

    if (minDistance < circle.radius) {
      const intersecting = possibleIntersectors.find(
        (i) => i.distance(rayEnd) <= circle.radius,
      )!;

      if (ignoreCollision) {
        circle.center = vec2.add(circle.center, circle.center, delta);
      } else {
        if (reactsToCollision(intersecting)) {
          intersecting.onCollision(circle.gameObject);
        }

        if (reactsToCollision(circle)) {
          circle.onCollision(intersecting.gameObject);
        }
      }

      vec2.add(
        rayEnd,
        circle.center,
        vec2.scale(vec2.create(), direction, travelled - prevMinDistance),
      );

      vec2.copy(circle.center, rayEnd);

      const dx =
        evaluateSdf(vec2.add(vec2.create(), rayEnd, vec2.fromValues(0.01, 0)), [
          intersecting,
        ]) -
        evaluateSdf(vec2.add(vec2.create(), rayEnd, vec2.fromValues(-0.01, 0)), [
          intersecting,
        ]);
      const dy =
        evaluateSdf(vec2.add(vec2.create(), rayEnd, vec2.fromValues(0, 0.01)), [
          intersecting,
        ]) -
        evaluateSdf(vec2.add(vec2.create(), rayEnd, vec2.fromValues(0, -0.01)), [
          intersecting,
        ]);
      const normal = vec2.fromValues(dx, dy);
      vec2.normalize(normal, normal);
      const rotatedNormal = rotate90Deg(normal);
      return {
        realDelta: delta,
        hitSurface: true,
        normal,
        hitObject: intersecting?.gameObject,
        tangent:
          vec2.dot(rotatedNormal, delta) < 0
            ? vec2.scale(rotatedNormal, rotatedNormal, -1)
            : rotatedNormal,
      };
    }

    prevMinDistance = minDistance;
  }

  vec2.add(circle.center, circle.center, delta);

  return {
    realDelta: delta,
    hitSurface: false,
  };
};
