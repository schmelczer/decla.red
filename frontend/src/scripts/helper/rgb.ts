import { vec3 } from 'gl-matrix';

export const rgb = (r: number, g: number, b: number): vec3 => vec3.fromValues(r, g, b);
