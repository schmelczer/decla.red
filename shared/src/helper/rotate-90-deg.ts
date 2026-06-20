import { vec2 } from 'gl-matrix';

export const rotate90Deg = (vec: vec2): vec2 => vec2.fromValues(-vec[1], vec[0]);
