import { Circle } from 'shared';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';
import { ImmutableBoundingBox } from '../bounding-boxes/immutable-bounding-box';

export const getBoundingBoxOfCircle = (circle: Circle): BoundingBoxBase =>
  new ImmutableBoundingBox(
    circle.center.x - circle.radius,
    circle.center.x + circle.radius,
    circle.center.y - circle.radius,
    circle.center.y + circle.radius,
  );
