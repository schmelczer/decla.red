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
): {
  realDelta: vec2;
  hitSurface: boolean;
  normal?: vec2;
  tangent?: vec2;
  hitObject?: GameObject;
} => {
  const nextCircle = new Circle(vec2.clone(circle.center), circle.radius);
  vec2.add(nextCircle.center, nextCircle.center, delta);

  possibleIntersectors = possibleIntersectors.filter(
    (b) => b.gameObject !== circle.gameObject && b.canCollide,
  );

  const sdfAtCenter = evaluateSdf(nextCircle.center, possibleIntersectors);

  if (sdfAtCenter > nextCircle.radius) {
    circle.center = vec2.add(circle.center, circle.center, delta);

    return {
      realDelta: delta,
      hitSurface: false,
    };
  }

  const intersecting = possibleIntersectors.find(
    (i) => i.distance(nextCircle.center) <= circle.radius,
  )!;

  if (reactsToCollision(intersecting)) {
    intersecting.onCollision(circle.gameObject);
  }

  if (reactsToCollision(circle)) {
    circle.onCollision(intersecting.gameObject);
  }

  const dx =
    evaluateSdf(vec2.add(vec2.create(), nextCircle.center, vec2.fromValues(0.01, 0)), [
      intersecting,
    ]) - sdfAtCenter;
  const dy =
    evaluateSdf(vec2.add(vec2.create(), nextCircle.center, vec2.fromValues(0, 0.01)), [
      intersecting,
    ]) - sdfAtCenter;
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
};
