import { Circle } from 'shared';
import { ImmutableBoundingBox } from '../bounding-boxes/immutable-bounding-box';

export const getBoundingBoxOfCircle = (circle: Circle): ImmutableBoundingBox =>
  new ImmutableBoundingBox(
    circle.center.x - circle.radius,
    circle.center.x + circle.radius,
    circle.center.y - circle.radius,
    circle.center.y + circle.radius,
  );
