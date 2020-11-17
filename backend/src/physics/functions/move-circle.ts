import { vec2 } from 'gl-matrix';
import { GameObject } from 'shared';
import { CirclePhysical } from '../../objects/circle-physical';
import { evaluateSdf } from './evaluate-sdf';
import { Physical } from '../physicals/physical';
import { ReactToCollisionCommand } from '../../commands/react-to-collision';

export const moveCircle = (
  circle: CirclePhysical,
  delta: vec2,
  possibleIntersectors: Array<Physical>,
  ignoreCollision = false,
): {
  hitSurface: boolean;
  normal?: vec2;
  hitObject?: GameObject;
} => {
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
        intersecting.handleCommand(new ReactToCollisionCommand(circle.gameObject));
        circle.handleCommand(new ReactToCollisionCommand(intersecting.gameObject));
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
      return {
        hitSurface: true,
        normal,
        hitObject: intersecting?.gameObject,
      };
    }

    prevMinDistance = minDistance;
  }

  vec2.add(circle.center, circle.center, delta);

  return {
    hitSurface: false,
  };
};
