import { vec2 } from 'gl-matrix';
import { clamp, clamp01 } from '../helper/clamp';
import { settings } from '../settings';

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

// Plain array literals, not vec2.create(): these are allocated before
// setMatrixArrayType(Array) runs and must be f64 like the rest of the simulation.
const localPoint: vec2 = [0, 0];
const targetFromDelta: vec2 = [0, 0];
const toFromDelta: vec2 = [0, 0];
const closestOnEdge: vec2 = [0, 0];
const edgeSample: vec2 = [0, 0];

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
