import { Circle } from 'shared';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

export const getBoundingBoxOfCircle = (circle: Circle): BoundingBoxBase =>
  new BoundingBoxBase(
    circle.center.x - circle.radius,
    circle.center.x + circle.radius,
    circle.center.y - circle.radius,
    circle.center.y + circle.radius,
  );
