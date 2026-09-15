export const smoothing = (deltaTimeInSeconds: number, seconds: number): number =>
  1 - Math.exp(-deltaTimeInSeconds / seconds);
