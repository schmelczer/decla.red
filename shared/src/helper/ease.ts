import { vec2 } from 'gl-matrix';

export const smoothing = (deltaTimeInSeconds: number, seconds: number): number =>
  1 - Math.exp(-deltaTimeInSeconds / seconds);

export const easeVec2 = (
  out: vec2,
  target: vec2,
  deltaTimeInSeconds: number,
  seconds: number,
  snapDistance: number,
): vec2 =>
  vec2.distance(out, target) > snapDistance
    ? vec2.copy(out, target)
    : vec2.lerp(out, out, target, smoothing(deltaTimeInSeconds, seconds));
