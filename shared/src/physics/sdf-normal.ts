import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';

// Central-difference gradient of the combined SDF. Can be zero where the
// samples cancel out (e.g. on the medial axis of a shape) — callers must
// handle that case. Uses indexed access so it never depends on the vec2 .x/.y
// prototype plugin (identical numerically: .x === [0]).
export const sdfNormal = (target: vec2, objects: Array<Sdf>): vec2 => {
  const dx =
    evaluateSdf(vec2.fromValues(target[0] + 0.01, target[1]), objects) -
    evaluateSdf(vec2.fromValues(target[0] - 0.01, target[1]), objects);
  const dy =
    evaluateSdf(vec2.fromValues(target[0], target[1] + 0.01), objects) -
    evaluateSdf(vec2.fromValues(target[0], target[1] - 0.01), objects);

  const normal = vec2.fromValues(dx, dy);
  return vec2.squaredLength(normal) > 0 ? vec2.normalize(normal, normal) : normal;
};
