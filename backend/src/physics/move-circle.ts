import { vec2 } from 'gl-matrix';
import { Circle, rotate90Deg } from 'shared';
import { CirclePhysical } from '../objects/circle-physical';
import { Physical } from './physical';

export const moveCircle = (
  circle: CirclePhysical,
  delta: vec2,
  possibleIntersectors: Array<Physical>,
): {
  realDelta: vec2;
  hitSurface: boolean;
  normal?: vec2;
  tangent?: vec2;
} => {
  const nextCircle = new Circle(vec2.clone(circle.center), circle.radius);
  vec2.add(nextCircle.center, nextCircle.center, delta);

  possibleIntersectors = possibleIntersectors.filter(
    (b) => b.gameObject !== circle.gameObject && b.canCollide,
  );

  const getSdfAtPoint = (point: vec2): number => {
    const sdf = possibleIntersectors
      .filter((i) => i.isInverted)
      .reduce((min, i) => (min = Math.max(min, -i.distance(point))), -1000);

    return possibleIntersectors
      .filter((i) => !i.isInverted)
      .reduce((min, i) => (min = Math.min(min, i.distance(point))), sdf);
  };

  const sdfAtCenter = getSdfAtPoint(nextCircle.center);

  if (sdfAtCenter > nextCircle.radius) {
    circle.center = vec2.add(circle.center, circle.center, delta);
    return {
      realDelta: delta,
      hitSurface: false,
    };
  }

  const dx =
    getSdfAtPoint(vec2.add(vec2.create(), nextCircle.center, vec2.fromValues(1, 0))) -
    sdfAtCenter;
  const dy =
    getSdfAtPoint(vec2.add(vec2.create(), nextCircle.center, vec2.fromValues(0, 1))) -
    sdfAtCenter;
  const normal = vec2.fromValues(dx, dy);

  vec2.normalize(normal, normal);

  return {
    realDelta: delta,
    hitSurface: true,
    normal,
    tangent: rotate90Deg(normal),
  };
};
