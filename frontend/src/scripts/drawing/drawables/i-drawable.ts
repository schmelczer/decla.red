import { vec2 } from 'gl-matrix';

export interface IDrawable {
  distance(target: vec2): number;
  serializeToUniforms(uniforms: any): void;
}
