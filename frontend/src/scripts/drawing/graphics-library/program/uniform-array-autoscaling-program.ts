import { vec2 } from 'gl-matrix';
import { FragmentShaderOnlyProgram } from './fragment-shader-only-program';
import { IProgram } from './i-program';
import { last } from '../../../helper/last';
import { getCombinations } from '../../../helper/get-combinations';
import { IDrawableDescriptor } from '../../drawables/i-drawable-descriptor';

export class UniformArrayAutoScalingProgram implements IProgram {
  private programs: Array<{
    program: FragmentShaderOnlyProgram;
    values: Array<number>;
  }> = [];
  private current: FragmentShaderOnlyProgram;

  private drawingRectangleTopLeft = vec2.fromValues(0, 0);
  private drawingRectangleSize = vec2.fromValues(1, 1);

  constructor(
    private gl: WebGL2RenderingContext,
    shaderSources: [string, string],
    private options: Array<IDrawableDescriptor>
  ) {
    const names = options.map((o) => o.countMacroName);
    for (let combination of getCombinations(
      options.map((o) => o.shaderCombinationSteps)
    )) {
      this.createProgram(names, combination, shaderSources);
    }
  }

  public bindAndSetUniforms(uniforms: { [name: string]: any }): void {
    let values = this.options.map((o) =>
      uniforms[o.uniformName] ? uniforms[o.uniformName].length : 0
    );

    const closest = this.programs.find((p) =>
      p.values.every((v, i) => v >= values[i])
    );

    this.current = closest ? closest.program : last(this.programs).program;

    this.current.setDrawingRectangle(
      this.drawingRectangleTopLeft,
      this.drawingRectangleSize
    );
    this.current.bindAndSetUniforms(uniforms);
  }

  public setDrawingRectangle(topLeft: vec2, size: vec2) {
    this.drawingRectangleTopLeft = topLeft;
    this.drawingRectangleSize = size;
  }

  public draw(): void {
    this.current.draw();
  }

  public delete(): void {
    this.programs.forEach((p) => p.program.delete());
  }

  private createProgram(
    names: Array<string>,
    combination: Array<number>,
    shaderSources: [string, string]
  ): FragmentShaderOnlyProgram {
    const substitutions = {};
    names.forEach((v, i) => (substitutions[v] = combination[i].toString()));

    const program = new FragmentShaderOnlyProgram(
      this.gl,
      shaderSources,
      substitutions
    );

    this.programs.push({
      program,
      values: combination,
    });

    return program;
  }
}
