import { vec3 } from 'gl-matrix';
import { clamp01 } from './clamp';
import { mix } from './mix';

export const mixRgb = (a: vec3, b: vec3, q: number): vec3 => {
  const clampedQ = clamp01(q);
  return vec3.fromValues(
    mix(a[0], b[0], clampedQ),
    mix(a[1], b[1], clampedQ),
    mix(a[2], b[2], clampedQ),
  );
};
