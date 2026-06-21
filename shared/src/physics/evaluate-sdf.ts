import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';

export const evaluateSdf = (target: vec2, objects: Array<Sdf>) =>
  objects
    .filter((i) => i.canCollide)
    .reduce((min, i) => (min = Math.min(min, i.distance(target))), 1000000);
