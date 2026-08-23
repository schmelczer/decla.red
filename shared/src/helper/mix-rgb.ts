import { vec3 } from 'gl-matrix';
import { clamp01 } from './clamp';
import { mix } from './mix';

// Component-wise lerp of two colours. Kept as a helper because the alternative
// is the same clamp-plus-three-mixes expansion repeated at every call site.
export const mixRgb = (a: vec3, b: vec3, q: number): vec3 => {
  const clampedQ = clamp01(q);
  return vec3.fromValues(
    mix(a[0], b[0], clampedQ),
    mix(a[1], b[1], clampedQ),
    mix(a[2], b[2], clampedQ),
  );
};
