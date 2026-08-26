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

// Follows a *moving* target. `easeVec2` alone lags one by an amount that depends on the frame
// duration, so an uneven frame — or a dropped one — changes the lag and the follower appears to
// speed up or stall. Carrying the target's own displacement first leaves only the residual to
// decay: a target at a steady speed is tracked exactly, whatever the frame times do, and a
// correction still fades out over `seconds`.
export const followVec2 = (
  out: vec2,
  target: vec2,
  previousTarget: vec2,
  deltaTimeInSeconds: number,
  seconds: number,
  snapDistance: number,
): vec2 => {
  out[0] += target[0] - previousTarget[0];
  out[1] += target[1] - previousTarget[1];
  vec2.copy(previousTarget, target);
  return easeVec2(out, target, deltaTimeInSeconds, seconds, snapDistance);
};
