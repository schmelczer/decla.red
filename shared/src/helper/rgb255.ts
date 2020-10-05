import { vec3 } from 'gl-matrix';

export const rgb255 = (r: number, g: number, b: number): vec3 =>
  vec3.fromValues(r / 255, g / 255, b / 255);
