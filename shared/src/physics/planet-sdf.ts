import { vec2 } from 'gl-matrix';
import { clamp, clamp01 } from '../helper/clamp';
import { settings } from '../settings';

// Rotate a world point into the planet's own frame: R(-rotation) about the
// centre, matching the shader's localTarget = center + R(rotation)*(target-center).
// cos/sin are passed in so callers can memoise them per angle. `out` is written
// in place, so the hot path can hand in a scratch vector instead of allocating.
export const toPlanetLocalFrame = (
  out: vec2,
  target: vec2,
  center: vec2,
  cos: number,
  sin: number,
): vec2 => {
  const dx = target[0] - center[0];
  const dy = target[1] - center[1];
  return vec2.set(out, center[0] + cos * dx - sin * dy, center[1] + sin * dx + cos * dy);
};

// Scratch vectors for planetDistance. It is the innermost leaf of the physics
// stack — called for every planet on every SDF sample — and allocating four
// vectors per polygon edge dominated its cost. Nothing re-enters it (callers
// evaluate planets one after another), and none of these outlive the call.
const localPoint = vec2.create();
const targetFromDelta = vec2.create();
const toFromDelta = vec2.create();
const closestOnEdge = vec2.create();
// [distance to the edge, which side of it]. These two stay in a vec2 rather
// than in plain numbers because a vec2 is a Float32Array: rounding them to f32
// is part of the outline the server and the client both have to agree on.
const edgeSample = vec2.create();

// Signed distance to the (smooth, noise-free) planet polygon, evaluated in the
// planet's rotating frame. This is the one and only planet outline: the
// authoritative server and the client predictor both collide against it, which
// is what lets prediction reconcile at all. Indexed vector access keeps it
// independent of the .x/.y prototype plugin.
export const planetDistance = (
  target: vec2,
  vertices: Array<vec2>,
  center: vec2,
  cos: number,
  sin: number,
): number => {
  const local = toPlanetLocalFrame(localPoint, target, center, cos, sin);

  const startEnd = vertices[0];
  let vb = startEnd;

  let d = vec2.dist(local, vb);
  let sign = 1;

  for (let i = 1; i <= vertices.length; i++) {
    const va = vb;
    vb = i === vertices.length ? startEnd : vertices[i];
    vec2.subtract(targetFromDelta, local, va);
    vec2.subtract(toFromDelta, vb, va);
    const h = clamp01(
      vec2.dot(targetFromDelta, toFromDelta) / vec2.squaredLength(toFromDelta),
    );

    vec2.set(
      edgeSample,
      vec2.dist(targetFromDelta, vec2.scale(closestOnEdge, toFromDelta, h)),
      toFromDelta[0] * targetFromDelta[1] - toFromDelta[1] * targetFromDelta[0],
    );

    if (
      (local[1] >= va[1] && local[1] < vb[1] && edgeSample[1] > 0) ||
      (local[1] < va[1] && local[1] >= vb[1] && edgeSample[1] <= 0)
    ) {
      sign *= -1;
    }

    d = Math.min(d, edgeSample[0]);
  }

  return sign * d;
};

// Gravity a planet exerts at a world position.
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
