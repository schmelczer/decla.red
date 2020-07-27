import { vec2 } from 'gl-matrix';
import { FragmentShaderOnlyProgram } from './fragment-shader-only-program';
import { IProgram } from './i-program';

export class UniformArrayAutoScalingProgram implements IProgram {
  private programs: Array<{
    program: FragmentShaderOnlyProgram;
    value: number;
  }> = [];
  private current: FragmentShaderOnlyProgram;

  private drawingRectangleTopLeft = vec2.fromValues(0, 0);
  private drawingRectangleSize = vec2.fromValues(1, 1);

  constructor(
    private gl: WebGL2RenderingContext,
    private vertexShaderSource: string,
    private fragmentShaderSource: string,
    private substitutions: { [name: string]: any },
    private options: {
      getValueFromUniforms: (values: { [name: string]: any }) => number;
      uniformArraySizeName: string;
      enablingMacro: string;
      startingValue: number;
      steps: number;
      maximumValue: number;
    }
  ) {
    for (
      let i = options.startingValue;
      i < options.maximumValue;
      i += options.steps
    ) {
      this.createProgram(i);
    }
  }

  public bindAndSetUniforms(values: { [name: string]: any }): void {
    let value = this.options.getValueFromUniforms(values);
    value = Math.min(this.options.maximumValue, value);

    const closest = this.programs.find(
      (p) => value < p.value && value + this.options.steps >= p.value
    );
    if (closest) {
      this.current = closest.program;
    } else {
      this.current = this.createProgram(value + this.options.steps);
    }

    this.current.setDrawingRectangle(
      this.drawingRectangleTopLeft,
      this.drawingRectangleSize
    );
    this.current.bindAndSetUniforms(values);
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

  private createProgram(arraySize: number): FragmentShaderOnlyProgram {
    const program = new FragmentShaderOnlyProgram(
      this.gl,
      this.vertexShaderSource,
      this.fragmentShaderSource,
      {
        [this.options.uniformArraySizeName]: Math.floor(arraySize).toString(),
        [this.options.enablingMacro]: arraySize > 0 ? '1' : '0',
        ...this.substitutions,
      }
    );

    this.programs.push({
      program,
      value: arraySize,
    });

    return program;
  }
}
