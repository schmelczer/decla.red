const shortAngleDist = (a0: number, a1: number): number => {
  const max = Math.PI * 2;
  const da = (a1 - a0) % max;
  return ((2 * da) % max) - da;
};

export const interpolateAngles = (a0: number, a1: number, t: number) => {
  return a0 + shortAngleDist(a0, a1) * t;
};
