import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';

// Reused probe point — sdfNormal is called on every depenetration pass and
// raymarch hit. A plain array literal for the same reason as planet-sdf's
// scratch: it is allocated before setMatrixArrayType(Array) runs, and the
// gradient must be computed at f64 like the rest of the simulation.
const probe: vec2 = [0, 0];

const sampleAt = (x: number, y: number, objects: Array<Sdf>): number => {
  vec2.set(probe, x, y);
  return evaluateSdf(probe, objects);
};

// Central-difference gradient. Can be zero where samples cancel (e.g. on the
// medial axis) — callers must handle that. Indexed access keeps it independent
// of the vec2 .x/.y prototype plugin.
export const sdfNormal = (target: vec2, objects: Array<Sdf>): vec2 => {
  const dx =
    sampleAt(target[0] + 0.01, target[1], objects) -
    sampleAt(target[0] - 0.01, target[1], objects);
  const dy =
    sampleAt(target[0], target[1] + 0.01, objects) -
    sampleAt(target[0], target[1] - 0.01, objects);

  const normal = vec2.fromValues(dx, dy);
  return vec2.squaredLength(normal) > 0 ? vec2.normalize(normal, normal) : normal;
};
