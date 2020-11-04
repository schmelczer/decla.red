export const interpolateAngles = (from: number, to: number, q: number) => {
  const max = Math.PI * 2;
  const possibleDistance = (to - from) % max;
  const shortedDistance = ((2 * possibleDistance) % max) - possibleDistance;
  return from + shortedDistance * q;
};
