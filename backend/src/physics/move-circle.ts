import { vec2 } from 'gl-matrix';
import { rotate90Deg, settings } from 'shared';
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
  circle.center = vec2.add(circle.center, circle.center, delta);

  const intersecting = possibleIntersectors.filter(
    (b) =>
      b.gameObject !== circle.gameObject && circle.areIntersecting(b) && b.canCollide,
  );

  if (intersecting.length === 0) {
    return {
      realDelta: delta,
      hitSurface: false,
    };
  }

  const points = circle.getPerimeterPoints(settings.hitDetectionCirclePointCount);

  const distancesOfPoints = points
    .map((point) => ({
      point,
      closest: intersecting
        .map((i) => ({
          inverted: i.isInverted,
          distance: i.distance(point),
        }))
        .sort((a, b) => a.distance - b.distance)[0],
    }))
    .filter((i) => i.closest);

  const distancesOfIntersectingPoints = distancesOfPoints.filter(
    (d) =>
      (d.closest.distance > 0 && d.closest.inverted) ||
      (d.closest.distance < 0 && !d.closest.inverted),
  );

  if (distancesOfIntersectingPoints.length === 0) {
    return {
      realDelta: delta,
      hitSurface: false,
    };
  }

  const deltas = distancesOfIntersectingPoints.map((pointDistance) => {
    vec2.subtract(pointDistance.point, circle.center, pointDistance.point);
    vec2.normalize(pointDistance.point, pointDistance.point);
    vec2.scale(
      pointDistance.point,
      pointDistance.point,
      (pointDistance.closest.inverted ? 1 : -1) * pointDistance.closest.distance,
    );
    return pointDistance.point;
  });

  const approxNormal = deltas.reduce(
    (sum, current) => vec2.add(sum, sum, current),
    vec2.create(),
  );
  vec2.scale(approxNormal, approxNormal, 1 / deltas.length);

  circle.center = vec2.add(circle.center, circle.center, approxNormal);

  vec2.normalize(approxNormal, approxNormal);
  return {
    realDelta: delta,
    hitSurface: true,
    normal: approxNormal,
    tangent: rotate90Deg(approxNormal),
  };
};
