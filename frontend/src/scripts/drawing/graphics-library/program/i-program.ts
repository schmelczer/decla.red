export interface IProgram {
  bindAndSetUniforms(values: { [name: string]: any }): void;
  draw(): void;
  delete(): void;
}
