import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';

// Reused probe point. sdfNormal is called on every depenetration pass and every
// raymarch hit, so allocating four sample vectors per call was a meaningful
// share of the physics step's garbage. evaluateSdf reads the probe and returns
// before the next vec2.set, so one is enough.
const probe = vec2.create();

const sampleAt = (x: number, y: number, objects: Array<Sdf>): number => {
  vec2.set(probe, x, y);
  return evaluateSdf(probe, objects);
};

// Central-difference gradient of the combined SDF. Can be zero where the
// samples cancel out (e.g. on the medial axis of a shape) — callers must
// handle that case. Uses indexed access so it never depends on the vec2 .x/.y
// prototype plugin (identical numerically: .x === [0]).
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
