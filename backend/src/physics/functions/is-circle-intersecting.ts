import { Circle, evaluateSdf } from 'shared';
import { PhysicalBase } from '../physicals/physical-base';

export const isCircleIntersecting = (
  circle: Circle,
  intersectors: Array<PhysicalBase>,
): boolean => evaluateSdf(circle.center, intersectors) < circle.radius;
