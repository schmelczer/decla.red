import { Circle } from 'shared';
import { evaluateSdf } from './evaluate-sdf';
import { PhysicalBase } from '../physicals/physical-base';

export const isCircleIntersecting = (
  circle: Circle,
  intersectors: Array<PhysicalBase>,
): boolean => evaluateSdf(circle.center, intersectors) < circle.radius;
