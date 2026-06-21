import { vec2 } from 'gl-matrix';
import { clamp, clamp01 } from '../helper/clamp';
import { settings } from '../settings';

// Rotate a world point into the planet's own frame: R(-rotation) about the
// centre, matching the shader's localTarget = center + R(rotation)*(target-center).
// cos/sin are passed in so the server can keep memoising them per angle.
export const toPlanetLocalFrame = (
  target: vec2,
  center: vec2,
  cos: number,
  sin: number,
): vec2 => {
  const dx = target[0] - center[0];
  const dy = target[1] - center[1];
  return vec2.fromValues(
    center[0] + cos * dx - sin * dy,
    center[1] + sin * dx + cos * dy,
  );
};

// Signed distance to the (smooth, noise-free) planet polygon, evaluated in the
// planet's rotating frame. Extracted verbatim from PlanetPhysical.distance so
// the client collides against the exact same outline the server does. Indexed
// vector access keeps it independent of the .x/.y prototype plugin.
export const planetDistance = (
  target: vec2,
  vertices: Array<vec2>,
  center: vec2,
  cos: number,
  sin: number,
): number => {
  const local = toPlanetLocalFrame(target, center, cos, sin);

  const startEnd = vertices[0];
  let vb = startEnd;

  let d = vec2.dist(local, vb);
  let sign = 1;

  for (let i = 1; i <= vertices.length; i++) {
    const va = vb;
    vb = i === vertices.length ? startEnd : vertices[i];
    const targetFromDelta = vec2.subtract(vec2.create(), local, va);
    const toFromDelta = vec2.subtract(vec2.create(), vb, va);
    const h = clamp01(
      vec2.dot(targetFromDelta, toFromDelta) / vec2.squaredLength(toFromDelta),
    );

    const ds = vec2.fromValues(
      vec2.dist(targetFromDelta, vec2.scale(vec2.create(), toFromDelta, h)),
      toFromDelta[0] * targetFromDelta[1] - toFromDelta[1] * targetFromDelta[0],
    );

    if (
      (local[1] >= va[1] && local[1] < vb[1] && ds[1] > 0) ||
      (local[1] < va[1] && local[1] >= vb[1] && ds[1] <= 0)
    ) {
      sign *= -1;
    }

    d = Math.min(d, ds[0]);
  }

  return sign * d;
};

// Gravity a planet exerts at a world position. Verbatim from
// PlanetPhysical.getForce.
export const planetGravity = (center: vec2, radius: number, position: vec2): vec2 => {
  const diff = vec2.subtract(vec2.create(), center, position);
  const dist = Math.max(settings.minGravityDistance, vec2.length(diff) - radius);
  vec2.normalize(diff, diff);
  const scale = clamp(
    settings.maxGravityQ * ((settings.maxGravityDistance / dist) ** 1.5 - 1),
    0,
    settings.maxGravityStrength,
  );
  return vec2.scale(diff, diff, scale);
};
