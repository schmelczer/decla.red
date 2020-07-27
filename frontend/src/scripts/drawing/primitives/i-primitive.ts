import { vec2 } from 'gl-matrix';

export interface IPrimitive {
  distance(target: vec2): number;
  minimumDistance(target: vec2): number;
}
