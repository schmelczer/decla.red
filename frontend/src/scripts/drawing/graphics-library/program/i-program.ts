import { vec2 } from 'gl-matrix';

export interface IProgram {
  bindAndSetUniforms(values: { [name: string]: any }): void;
  setDrawingRectangle(topLeft: vec2, size: vec2): void;
  draw(): void;
  delete(): void;
}
