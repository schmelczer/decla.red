import { vec2 } from 'gl-matrix';
import { PhysicalBase } from '../physicals/physical-base';

export const evaluateSdf = (target: vec2, objects: Array<PhysicalBase>) =>
  objects
    .filter((i) => i.canCollide)
    .reduce((min, i) => (min = Math.min(min, i.distance(target))), 1000);
