import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';

// Plain array literal for the same reason as planet-sdf's scratch vectors.
const probe: vec2 = [0, 0];

const sampleAt = (x: number, y: number, objects: Array<Sdf>): number => {
  vec2.set(probe, x, y);
  return evaluateSdf(probe, objects);
};

export const sdfNormal = (target: vec2, objects: Array<Sdf>): vec2 => {
  const dx =
    sampleAt(target[0] + 0.01, target[1], objects) -
    sampleAt(target[0] - 0.01, target[1], objects);
  const dy =
    sampleAt(target[0], target[1] + 0.01, objects) -
    sampleAt(target[0], target[1] - 0.01, objects);

  const normal = vec2.fromValues(dx, dy);
  return vec2.normalize(normal, normal);
};
