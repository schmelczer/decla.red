import { vec2 } from 'gl-matrix';

export const rotateMinus90Deg = (vec: vec2): vec2 => vec2.fromValues(vec.y, -vec.x);
